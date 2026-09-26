import { Prisma, type AccountType, type TransactionType } from "@prisma/client";

/**
 * Datos de un movimiento necesarios para saber cómo afecta a los balances.
 */
export type BalanceTx = {
  type: TransactionType;
  amount: Prisma.Decimal | number | string;
  accountId: string;
  accountType: AccountType;
  transferAccountId?: string | null;
  transferAccountType?: AccountType | null;
};

export type BalanceDelta = { accountId: string; delta: Prisma.Decimal };

/**
 * Cambio en el balance de una cuenta cuando entra (`in`) o sale (`out`) dinero.
 * En crédito el balance es la deuda, así que entrar dinero la reduce (pagar la
 * tarjeta, un reembolso) y sacarlo la aumenta (un gasto, retirar efectivo).
 */
function flow(
  accountType: AccountType,
  direction: "in" | "out",
  amount: Prisma.Decimal
): Prisma.Decimal {
  const signed = direction === "in" ? amount : amount.neg();
  return accountType === "CREDIT" ? signed.neg() : signed;
}

/**
 * Cambios que un movimiento (no MSI) aplica al balance de cada cuenta al crearse.
 * Borrarlo aplica los mismos cambios con signo contrario.
 *
 * - EXPENSE: sale dinero de la cuenta (en crédito aumenta la deuda)
 * - INCOME: entra dinero a la cuenta (en crédito reduce la deuda)
 * - TRANSFER: sale de la cuenta origen y entra a la destino
 */
export function balanceEffects(tx: BalanceTx): BalanceDelta[] {
  const amount = new Prisma.Decimal(tx.amount);

  switch (tx.type) {
    case "EXPENSE":
      return [{ accountId: tx.accountId, delta: flow(tx.accountType, "out", amount) }];
    case "INCOME":
      return [{ accountId: tx.accountId, delta: flow(tx.accountType, "in", amount) }];
    case "TRANSFER":
      // Datos legacy sin cuenta destino: no se aplicó nada al crearla
      if (!tx.transferAccountId) return [];
      if (!tx.transferAccountType) {
        throw new Error("transferAccountType es requerido para transferencias");
      }
      return [
        { accountId: tx.accountId, delta: flow(tx.accountType, "out", amount) },
        {
          accountId: tx.transferAccountId,
          delta: flow(tx.transferAccountType, "in", amount),
        },
      ];
  }
}

/** Cambios para revertir un movimiento (al borrarlo). */
export function revertEffects(tx: BalanceTx): BalanceDelta[] {
  return balanceEffects(tx).map((d) => ({ ...d, delta: d.delta.neg() }));
}

/** Suma los cambios por cuenta y quita las cuentas que quedan igual. */
export function mergeDeltas(deltas: BalanceDelta[]): BalanceDelta[] {
  const totals = new Map<string, Prisma.Decimal>();
  for (const { accountId, delta } of deltas) {
    totals.set(accountId, (totals.get(accountId) ?? new Prisma.Decimal(0)).add(delta));
  }
  return [...totals]
    .filter(([, delta]) => !delta.isZero())
    .map(([accountId, delta]) => ({ accountId, delta }));
}

/**
 * Cambios netos al editar un movimiento: revertir la versión anterior y
 * aplicar la nueva.
 */
export function editEffects(before: BalanceTx, after: BalanceTx): BalanceDelta[] {
  return mergeDeltas([...revertEffects(before), ...balanceEffects(after)]);
}

/** Aplica los cambios de balance dentro de una transacción de Prisma. */
export async function applyBalanceDeltas(
  tx: Prisma.TransactionClient,
  deltas: BalanceDelta[]
) {
  for (const { accountId, delta } of deltas) {
    await tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
  }
}

/**
 * Movimiento que lleva el balance de una cuenta de `from` a `to` (en crédito,
 * el balance es la deuda). Devuelve null si no hay cambio.
 */
export function adjustmentMovement(
  accountType: AccountType,
  from: Prisma.Decimal | number | string,
  to: Prisma.Decimal | number | string
): { type: "INCOME" | "EXPENSE"; amount: Prisma.Decimal } | null {
  const delta = new Prisma.Decimal(to).sub(from);
  if (delta.isZero()) return null;
  // En crédito, que suba el balance (la deuda) equivale a que salga dinero
  const increases = accountType === "CREDIT" ? delta.isNeg() : delta.isPos();
  return { type: increases ? "INCOME" : "EXPENSE", amount: delta.abs() };
}

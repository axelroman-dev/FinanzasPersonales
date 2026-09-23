import { Prisma, type AccountType, type TransactionType } from "@prisma/client";

/**
 * Versión de la regla con la que se aplicó un movimiento a los balances
 * (columna `Transaction.balanceRule`):
 *
 * - 1: regla anterior. Todo el dinero que entraba a una cuenta sumaba a su
 *   balance, también en tarjetas de crédito: pagar la tarjeta o recibir un
 *   reembolso *aumentaba* la deuda.
 * - 2: regla actual. En tarjetas de crédito el balance es la deuda, así que el
 *   dinero que entra la reduce y el que sale la aumenta.
 *
 * Los movimientos se revierten con la regla con la que se aplicaron, así que
 * los de regla 1 se pueden editar o borrar sin descuadrar nada.
 * `scripts/fix-credit-balances.ts` migra los movimientos de regla 1 a la 2.
 */
export const CURRENT_BALANCE_RULE = 2;

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
  /** Por defecto, la regla actual */
  balanceRule?: number;
};

export type BalanceDelta = { accountId: string; delta: Prisma.Decimal };

/**
 * Cambio en el balance de una cuenta cuando entra (`in`) o sale (`out`) dinero.
 * En crédito el balance es deuda: con la regla actual entrar dinero la reduce.
 */
function flow(
  accountType: AccountType,
  direction: "in" | "out",
  amount: Prisma.Decimal,
  rule: number
): Prisma.Decimal {
  const signed = direction === "in" ? amount : amount.neg();
  if (accountType !== "CREDIT") return signed;
  // Un gasto siempre aumentó la deuda, con cualquier regla
  if (rule === 1 && direction === "in") return signed;
  return signed.neg();
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
  const rule = tx.balanceRule ?? CURRENT_BALANCE_RULE;

  switch (tx.type) {
    case "EXPENSE":
      return [{ accountId: tx.accountId, delta: flow(tx.accountType, "out", amount, rule) }];
    case "INCOME":
      return [{ accountId: tx.accountId, delta: flow(tx.accountType, "in", amount, rule) }];
    case "TRANSFER":
      // Datos legacy sin cuenta destino: no se aplicó nada al crearla
      if (!tx.transferAccountId) return [];
      if (!tx.transferAccountType) {
        throw new Error("transferAccountType es requerido para transferencias");
      }
      return [
        { accountId: tx.accountId, delta: flow(tx.accountType, "out", amount, rule) },
        {
          accountId: tx.transferAccountId,
          delta: flow(tx.transferAccountType, "in", amount, rule),
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
 * Cambios netos al editar un movimiento: revertir la versión anterior (con la
 * regla con la que se aplicó) y aplicar la nueva.
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

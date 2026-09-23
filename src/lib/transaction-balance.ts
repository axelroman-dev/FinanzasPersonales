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
};

export type BalanceDelta = { accountId: string; delta: Prisma.Decimal };

/**
 * Cambios que un movimiento (no MSI) aplica al balance de cada cuenta al crearse.
 * Borrarlo aplica los mismos cambios con signo contrario.
 *
 * - EXPENSE: en crédito incrementa la deuda; en el resto reduce el disponible
 * - INCOME: incrementa el balance de la cuenta
 * - TRANSFER: resta de la cuenta origen y suma a la destino
 */
export function balanceEffects(tx: BalanceTx): BalanceDelta[] {
  const amount = new Prisma.Decimal(tx.amount);

  switch (tx.type) {
    case "EXPENSE":
      return [
        {
          accountId: tx.accountId,
          delta: tx.accountType === "CREDIT" ? amount : amount.neg(),
        },
      ];
    case "INCOME":
      return [{ accountId: tx.accountId, delta: amount }];
    case "TRANSFER":
      // Datos legacy sin cuenta destino: no se aplicó nada al crearla
      if (!tx.transferAccountId) return [];
      return [
        { accountId: tx.accountId, delta: amount.neg() },
        { accountId: tx.transferAccountId, delta: amount },
      ];
  }
}

/** Cambios para revertir un movimiento (al borrarlo). */
export function revertEffects(tx: BalanceTx): BalanceDelta[] {
  return balanceEffects(tx).map((d) => ({ ...d, delta: d.delta.neg() }));
}

/**
 * Cambios netos al editar un movimiento: revertir la versión anterior y
 * aplicar la nueva, agrupados por cuenta y sin las cuentas que quedan igual.
 */
export function editEffects(before: BalanceTx, after: BalanceTx): BalanceDelta[] {
  const totals = new Map<string, Prisma.Decimal>();
  for (const { accountId, delta } of [...revertEffects(before), ...balanceEffects(after)]) {
    totals.set(accountId, (totals.get(accountId) ?? new Prisma.Decimal(0)).add(delta));
  }
  return [...totals]
    .filter(([, delta]) => !delta.isZero())
    .map(([accountId, delta]) => ({ accountId, delta }));
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

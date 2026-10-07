import type { Account, Prisma } from "@prisma/client";
import { adjustmentMovement, applyBalanceDeltas, balanceEffects } from "@/lib/transaction-balance";

/**
 * Categorías internas (kind INTERNAL): las crea el sistema para movimientos
 * que no son un ingreso o gasto real (ajustes de saldo, pagos de tarjeta). Se
 * agrupan bajo una categoría raíz y se crean la primera vez que se necesitan.
 */
const INTERNAL_ROOTS = {
  ADJUSTMENTS: { name: "Ajustes", color: "#94a3b8", icon: "adjustments-horizontal" },
  CARDS: { name: "Tarjetas de crédito", color: "#60a5fa", icon: "credit-card" },
} as const;

export const INTERNAL_CATEGORIES = {
  INITIAL_BALANCE: "Balance inicial",
  ADJUSTMENT: "Ajuste de cuenta",
  CARD_PAYMENT: "Pago de tarjeta",
} as const;

export type InternalCategory = keyof typeof INTERNAL_CATEGORIES;

/** Raíz e icono de cada categoría interna */
const INTERNAL_PLACEMENT: Record<
  InternalCategory,
  { root: keyof typeof INTERNAL_ROOTS; icon: string }
> = {
  INITIAL_BALANCE: { root: "ADJUSTMENTS", icon: "adjustments-horizontal" },
  ADJUSTMENT: { root: "ADJUSTMENTS", icon: "adjustments-horizontal" },
  CARD_PAYMENT: { root: "CARDS", icon: "credit-card" },
};

/** Filtro de Prisma para dejar fuera los movimientos con categoría interna. */
export const excludeInternal = {
  OR: [{ categoryId: null }, { categoryRef: { kind: { not: "INTERNAL" } } }],
} satisfies Prisma.TransactionWhereInput;

/** Id de la categoría interna `key` del usuario; la crea si no existe */
export async function ensureInternalCategory(
  tx: Prisma.TransactionClient,
  userId: string,
  key: InternalCategory
): Promise<string> {
  const { root: rootKey, icon } = INTERNAL_PLACEMENT[key];
  const rootDef = INTERNAL_ROOTS[rootKey];
  const root =
    (await tx.category.findFirst({
      where: { userId, kind: "INTERNAL", parentId: null, name: rootDef.name },
    })) ??
    (await tx.category.create({
      data: { userId, kind: "INTERNAL", parentId: null, ...rootDef },
    }));

  const name = INTERNAL_CATEGORIES[key];
  const child = await tx.category.upsert({
    where: { userId_name_parentId: { userId, name, parentId: root.id } },
    update: {},
    create: {
      userId,
      name,
      parentId: root.id,
      kind: "INTERNAL",
      color: rootDef.color,
      icon,
    },
  });
  return child.id;
}

/**
 * Registra un movimiento con categoría interna que lleva el balance de la
 * cuenta de `from` a `to` y lo aplica. No hace nada si no hay cambio.
 */
export async function recordBalanceChange(
  tx: Prisma.TransactionClient,
  params: {
    account: Pick<Account, "id" | "userId" | "type">;
    from: Prisma.Decimal | number;
    to: Prisma.Decimal | number;
    key: "INITIAL_BALANCE" | "ADJUSTMENT";
  }
) {
  const { account, from, to, key } = params;
  const movement = adjustmentMovement(account.type, from, to);
  if (!movement) return null;

  const categoryId = await ensureInternalCategory(tx, account.userId, key);
  const created = await tx.transaction.create({
    data: {
      userId: account.userId,
      type: movement.type,
      amount: movement.amount,
      date: new Date(),
      description: INTERNAL_CATEGORIES[key],
      categoryId,
      accountId: account.id,
    },
  });

  await applyBalanceDeltas(
    tx,
    balanceEffects({
      type: movement.type,
      amount: movement.amount,
      accountId: account.id,
      accountType: account.type,
    })
  );
  return created;
}

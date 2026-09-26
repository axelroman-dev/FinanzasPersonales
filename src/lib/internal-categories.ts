import type { Account, Prisma } from "@prisma/client";
import { adjustmentMovement, applyBalanceDeltas, balanceEffects } from "@/lib/transaction-balance";

/**
 * Categorías internas (kind INTERNAL): las crea el sistema para registrar los
 * cambios de balance que no son un ingreso o gasto real. Se agrupan bajo una
 * categoría raíz y se crean la primera vez que se necesitan.
 */
const INTERNAL_ROOT = { name: "Ajustes", color: "#94a3b8", icon: "SlidersHorizontal" };

export const INTERNAL_CATEGORIES = {
  INITIAL_BALANCE: "Balance inicial",
  ADJUSTMENT: "Ajuste de cuenta",
} as const;

export type InternalCategory = keyof typeof INTERNAL_CATEGORIES;

/** Filtro de Prisma para dejar fuera los movimientos con categoría interna. */
export const excludeInternal = {
  OR: [{ categoryId: null }, { categoryRef: { kind: { not: "INTERNAL" } } }],
} satisfies Prisma.TransactionWhereInput;

async function ensureInternalCategory(
  tx: Prisma.TransactionClient,
  userId: string,
  key: InternalCategory
): Promise<string> {
  const root =
    (await tx.category.findFirst({
      where: { userId, kind: "INTERNAL", parentId: null, name: INTERNAL_ROOT.name },
    })) ??
    (await tx.category.create({
      data: { userId, kind: "INTERNAL", parentId: null, ...INTERNAL_ROOT },
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
      color: INTERNAL_ROOT.color,
      icon: INTERNAL_ROOT.icon,
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
    key: InternalCategory;
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

import { prisma } from "@/lib/db";
import { defaultCategories } from "../../prisma/default-categories";
import { excludeInternal } from "@/lib/internal-categories";

/**
 * Crea las categorías predeterminadas para un usuario recién registrado.
 * Idempotente: si el usuario ya tiene categorías, no hace nada.
 */
export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await prisma.category.count({
    where: { userId, kind: { not: "INTERNAL" } },
  });
  if (existing > 0) return;

  for (const cat of defaultCategories) {
    const parent = await prisma.category.create({
      data: {
        userId,
        name: cat.name,
        kind: cat.kind,
        color: cat.color,
        icon: cat.icon,
        parentId: null,
      },
    });

    if (cat.children) {
      for (const child of cat.children) {
        await prisma.category.create({
          data: {
            userId,
            name: child.name,
            kind: cat.kind, // heredamos del padre
            color: child.color ?? cat.color,
            icon: child.icon ?? cat.icon,
            parentId: parent.id,
          },
        });
      }
    }
  }
}

/**
 * Lista las categorías del usuario en forma de árbol, con conteo de uso:
 * [
 *   { id, name, color, icon, kind, usageCount, children: [...] },
 *   ...
 * ]
 */
export type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "BOTH" | "INTERNAL";
  parentId: string | null;
  usageCount: number;
  children: CategoryNode[];
};

export async function getCategoryTree(
  userId: string,
  kindFilter?: "INCOME" | "EXPENSE" | "BOTH"
): Promise<CategoryNode[]> {
  const [all, usage] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    }),
    // Cuenta movimientos por categoría (incluye la propia y sus hijos)
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const usageById = new Map<string, number>();
  for (const u of usage) {
    if (u.categoryId) {
      usageById.set(u.categoryId, u._count._all);
    }
  }

  const filtered = kindFilter
    ? all.filter((c) => c.kind === kindFilter || c.kind === "BOTH")
    : all;

  const byId = new Map<string, CategoryNode>();
  for (const c of filtered) {
    byId.set(c.id, {
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      kind: c.kind,
      parentId: c.parentId,
      usageCount: usageById.get(c.id) ?? 0,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
      // Sumar uso del hijo al padre (para que "Eliminar" sepa que hay uso)
      const parent = byId.get(node.parentId)!;
      parent.usageCount += node.usageCount;
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Suma de gastos/ingresos agrupados por categoría raíz (incluye subcategorías).
 * Devuelve un array ordenado de mayor a menor.
 */
export type CategoryTotal = {
  categoryId: string;
  categoryName: string;
  color: string | null;
  icon: string | null;
  total: number;
  count: number;
  percent: number;
};

export async function getCategoryTotals(params: {
  userId: string;
  type: "INCOME" | "EXPENSE";
  from?: Date;
  to?: Date;
}): Promise<CategoryTotal[]> {
  const { userId, type, from, to } = params;

  // Los ajustes de balance no son ingresos ni gastos reales
  const where: any = { userId, type, ...excludeInternal };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const txs = await prisma.transaction.findMany({
    where,
    include: { categoryRef: { include: { parent: true } } },
  });

  // Agrupar por categoría raíz
  const byRoot = new Map<
    string,
    { name: string; color: string | null; icon: string | null; total: number; count: number }
  >();

  for (const tx of txs) {
    // Determinar la categoría raíz (si es subcategoría, subir al padre)
    const rootCat = tx.categoryRef
      ? tx.categoryRef.parent ?? tx.categoryRef
      : null;

    const key = rootCat?.id ?? "__uncategorized__";
    const existing = byRoot.get(key);
    const amount = Number(tx.amount);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      byRoot.set(key, {
        name: rootCat?.name ?? "Sin categoría",
        color: rootCat?.color ?? null,
        icon: rootCat?.icon ?? null,
        total: amount,
        count: 1,
      });
    }
  }

  const totalSum = Array.from(byRoot.values()).reduce((s, x) => s + x.total, 0);

  return Array.from(byRoot.entries())
    .map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.name,
      color: v.color,
      icon: v.icon,
      total: v.total,
      count: v.count,
      percent: totalSum > 0 ? (v.total / totalSum) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Devuelve el gasto/ingreso del mes por subcategoría, dado un parentId.
 * Usado para mostrar el desglose en el panel derecho de /categories.
 *
 * Si type === undefined, devuelve ambos tipos (gastos e ingresos).
 */
export type SubcategoryStat = {
  subcategoryId: string;
  subcategoryName: string;
  color: string | null;
  count: number;
  total: number;
  byType: { INCOME: number; EXPENSE: number };
};

export async function getSubcategoryStats(params: {
  userId: string;
  parentId: string;
  type?: "INCOME" | "EXPENSE";
  from?: Date;
  to?: Date;
}): Promise<SubcategoryStat[]> {
  const { userId, parentId, type, from, to } = params;

  const where: any = { userId, categoryRef: { parentId } };
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }

  const txs = await prisma.transaction.findMany({
    where,
    include: { categoryRef: true },
  });

  const bySub = new Map<
    string,
    {
      name: string;
      color: string | null;
      total: number;
      count: number;
      byType: { INCOME: number; EXPENSE: number };
    }
  >();

  for (const tx of txs) {
    const sub = tx.categoryRef;
    if (!sub) continue;
    const txType = tx.type as "INCOME" | "EXPENSE";
    const amount = Number(tx.amount);
    const existing = bySub.get(sub.id);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
      existing.byType[txType] += amount;
    } else {
      bySub.set(sub.id, {
        name: sub.name,
        color: sub.color,
        total: amount,
        count: 1,
        byType: { INCOME: 0, EXPENSE: 0, [txType]: amount },
      });
    }
  }

  return Array.from(bySub.entries())
    .map(([id, v]) => ({
      subcategoryId: id,
      subcategoryName: v.name,
      color: v.color,
      total: v.total,
      count: v.count,
      byType: v.byType,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Devuelve los totales del mes agrupados por **categoría raíz** (parent),
 * para todos los tipos del usuario en UNA sola query. Esto evita N+1.
 *
 * Devuelve un Map<subcategoryId, {total, count}> y un Map<parentId, totalAcumulado>.
 * Cada subcategoría incluye además desglose por tipo (income/expense).
 */
export async function getMonthlyTotalsByRoot(params: {
  userId: string;
  from?: Date;
  to?: Date;
}): Promise<{
  bySubcategory: Map<
    string,
    {
      name: string;
      color: string | null;
      total: number;
      count: number;
      parentId: string | null;
      /** Desglose por tipo (para categorías BOTH) */
      byType: { INCOME: number; EXPENSE: number };
    }
  >;
  byParent: Map<string, number>;
}> {
  const { userId, from, to } = params;

  const dateWhere: any = {};
  if (from) dateWhere.gte = from;
  if (to) dateWhere.lte = to;

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: ["INCOME", "EXPENSE"] },
      ...(Object.keys(dateWhere).length > 0 ? { date: dateWhere } : {}),
      categoryRef: { isNot: null },
    },
    select: {
      type: true,
      amount: true,
      categoryRef: {
        select: {
          id: true,
          name: true,
          color: true,
          parent: { select: { id: true } },
        },
      },
    },
  });

  const bySubcategory = new Map<
    string,
    {
      name: string;
      color: string | null;
      total: number;
      count: number;
      parentId: string | null;
      byType: { INCOME: number; EXPENSE: number };
    }
  >();
  const byParent = new Map<string, number>();

  for (const tx of txs) {
    const sub = tx.categoryRef;
    if (!sub) continue;

    const parent = sub.parent ?? sub;
    const parentId = parent.id;
    const amount = Number(tx.amount);
    const txType = tx.type as "INCOME" | "EXPENSE";

    // Acumular por subcategoría
    const existing = bySubcategory.get(sub.id);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
      existing.byType[txType] += amount;
    } else {
      bySubcategory.set(sub.id, {
        name: sub.name,
        color: sub.color,
        total: amount,
        count: 1,
        parentId,
        byType: { INCOME: 0, EXPENSE: 0, [txType]: amount },
      });
    }

    // Acumular por raíz
    byParent.set(parentId, (byParent.get(parentId) ?? 0) + amount);
  }

  return { bySubcategory, byParent };
}
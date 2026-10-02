import { prisma } from "@/lib/db";

/**
 * Valida la categoría de una suscripción: debe ser del usuario y de gasto
 * (una suscripción es un cargo). null = sin categoría.
 */
export async function isValidSubscriptionCategory(
  userId: string,
  categoryId: string | null
): Promise<boolean> {
  if (!categoryId) return true;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, kind: "EXPENSE" },
    select: { id: true },
  });
  return !!category;
}

/** Primer y último instante del mes de `now` (hora del servidor) */
export function monthRange(now: Date): { start: Date; end: Date } {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export type SubscriptionMonthSummary = {
  /** Suma de las suscripciones activas */
  activeTotal: number;
  /** Activas que ya tienen un movimiento ligado este mes */
  paidTotal: number;
  /** Activas sin pago este mes: lo que falta descontar */
  pendingTotal: number;
};

/**
 * Una suscripción activa cuenta como pagada si tiene algún movimiento ligado
 * en el mes. Ese pago ya bajó el saldo de la cuenta, así que solo las
 * pendientes se restan del balance real.
 */
export function summarizeSubscriptions(
  subs: { id: string; amount: number; isActive: boolean }[],
  paidIds: Set<string>
): SubscriptionMonthSummary {
  const summary = { activeTotal: 0, paidTotal: 0, pendingTotal: 0 };
  for (const s of subs) {
    if (!s.isActive) continue;
    summary.activeTotal += s.amount;
    if (paidIds.has(s.id)) summary.paidTotal += s.amount;
    else summary.pendingTotal += s.amount;
  }
  return summary;
}

/** Ids de las suscripciones del usuario con un movimiento ligado en el mes */
export async function getPaidSubscriptionIds(
  userId: string,
  now: Date = new Date()
): Promise<Set<string>> {
  const { start, end } = monthRange(now);
  const payments = await prisma.transaction.findMany({
    where: {
      userId,
      subscriptionId: { not: null },
      date: { gte: start, lte: end },
    },
    select: { subscriptionId: true },
    distinct: ["subscriptionId"],
  });
  return new Set(payments.map((p) => p.subscriptionId!));
}

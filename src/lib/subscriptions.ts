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

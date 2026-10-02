/**
 * Tipos de categoría que el usuario puede elegir. INTERNAL existe en la base
 * pero lo gestiona el sistema (ver src/lib/internal-categories.ts).
 */
export type CategoryKind = "INCOME" | "EXPENSE";

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
};

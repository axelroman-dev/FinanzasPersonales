/** CARD_PAYMENT: pago de tarjeta, una transferencia a una tarjeta de crédito */
type TxType = "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT";

type CategoryNode = {
  id: string;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  children: CategoryNode[];
};

/** Valores con los que arranca el formulario de un movimiento nuevo */
export type NewTransactionDefaults = {
  type?: TxType;
  accountId?: string;
  categoryId?: string;
  isMsi?: boolean;
};

const TX_TYPES: TxType[] = ["INCOME", "EXPENSE", "TRANSFER", "CARD_PAYMENT"];

/**
 * Traduce los filtros de la lista de movimientos a valores iniciales del
 * formulario de nuevo movimiento: si estás viendo una cuenta, el movimiento
 * nuevo es de esa cuenta. Ignora lo que no aplica (cuenta inexistente,
 * categoría interna o de otro tipo). La principal solo agrupa, así que filtrar
 * por ella fija el tipo pero no la categoría.
 */
export function newTransactionDefaults(
  filters: { type?: string; accountId?: string; categoryId?: string; msi?: string },
  accountIds: string[],
  categories: CategoryNode[]
): NewTransactionDefaults {
  const defaults: NewTransactionDefaults = {};

  const filterType = TX_TYPES.find((t) => t === filters.type);
  if (filterType) defaults.type = filterType;

  if (filters.accountId && accountIds.includes(filters.accountId)) {
    defaults.accountId = filters.accountId;
  }

  if (filters.categoryId) {
    for (const root of categories) {
      if (root.kind === "INTERNAL") continue;
      const isRoot = root.id === filters.categoryId;
      const sub = root.children.find((c) => c.id === filters.categoryId);
      if (!isRoot && !sub) continue;
      // Un filtro de tipo que contradice la categoría manda sobre ella
      if (defaults.type && defaults.type !== root.kind) break;
      defaults.type = root.kind;
      if (sub) defaults.categoryId = sub.id;
      break;
    }
  }

  // Solo aplica a gastos en crédito; el formulario lo ignora si no
  if (filters.msi === "true") defaults.isMsi = true;

  return defaults;
}

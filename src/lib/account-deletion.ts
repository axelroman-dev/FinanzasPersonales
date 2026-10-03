import type { TransactionType } from "@prisma/client";

/**
 * Qué pasa con una transferencia cuando se elimina una de sus dos cuentas.
 *
 * Una transferencia equivale a "sale de la cuenta origen + entra a la
 * destino". Al eliminar una de las dos, la otra se queda con su mitad:
 * - se elimina el origen (A → B): pasa a ser un ingreso en B
 * - se elimina el destino (X → A): pasa a ser un gasto en X
 * El balance de la cuenta que queda no cambia, porque ese efecto ya estaba
 * aplicado. Sin la otra cuenta (transferencia sin destino) se borra.
 */
export type DetachedTransfer =
  | { action: "delete" }
  | {
      action: "update";
      data: {
        type: TransactionType;
        accountId: string;
        transferAccountId: null;
        description: string;
      };
    };

export function detachTransfer(
  tx: { accountId: string; transferAccountId: string | null; description: string },
  deleted: { id: string; name: string }
): DetachedTransfer {
  const note = (direction: "desde" | "hacia") =>
    `${tx.description} (transferencia ${direction} la cuenta eliminada "${deleted.name}")`;

  if (tx.accountId === deleted.id) {
    if (!tx.transferAccountId || tx.transferAccountId === deleted.id) return { action: "delete" };
    return {
      action: "update",
      data: {
        type: "INCOME",
        accountId: tx.transferAccountId,
        transferAccountId: null,
        description: note("desde"),
      },
    };
  }
  if (tx.transferAccountId === deleted.id) {
    return {
      action: "update",
      data: {
        type: "EXPENSE",
        accountId: tx.accountId,
        transferAccountId: null,
        description: note("hacia"),
      },
    };
  }
  throw new Error("La transferencia no involucra a la cuenta eliminada");
}

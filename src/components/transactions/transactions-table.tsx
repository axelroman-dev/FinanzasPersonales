"use client";

import {
  Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatShortDate, formatTime } from "@/lib/utils";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Minus,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  TransactionActions,
  type EditableTransaction,
  type TransactionFormOptions,
} from "./transaction-actions";
import { AttachmentsViewer } from "./attachments-viewer";
import { CategoryIcon } from "@/components/shared/category-icon";
import { useAlert, useConfirm } from "@/components/shared/confirm-dialog";

type Tx = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  category: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  /** Movimiento con categoría interna (balance inicial o ajuste de cuenta) */
  isAdjustment: boolean;
  /** Movimiento de «Balance inicial»: se muestra neutro, no es ingreso ni gasto */
  isInitialBalance: boolean;
  accountName: string;
  transferAccountName: string | null;
  isMsi: boolean;
  msiParentId: string | null;
  msiInstallments: number | null;
  subscriptionName: string | null;
  // Para el formulario de edición
  categoryId: string | null;
  accountId: string;
  transferAccountId: string | null;
  attachmentCount: number;
};

export function TransactionsTable({
  transactions,
  formOptions,
}: {
  transactions: Tx[];
  formOptions: TransactionFormOptions;
}) {
  return (
    <>
      {/* Móvil y tablet: tarjetas; la tabla de 6 columnas no cabe sin scroll horizontal */}
      <Card className="divide-y lg:hidden">
        {transactions.map((tx) => (
          <TransactionCard key={tx.id} tx={tx} formOptions={formOptions} />
        ))}
      </Card>

      <Card className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-2 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const { Icon, color, sign, label } = txVisuals(tx);
                return (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatShortDate(tx.date)}
                      <span className="block text-xs tabular-nums text-muted-foreground/70">
                        {formatTime(tx.date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TxIcon tx={tx} Icon={Icon} color={color} />
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <TxTags tx={tx} className="mt-0.5" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {tx.accountName}
                      {tx.transferAccountName && (
                        <span className="text-xs"> → {tx.transferAccountName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{label}</td>
                    <td
                      className={`px-4 py-3 text-sm font-semibold text-right tabular-nums ${color}`}
                    >
                      {sign}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <RowActions tx={tx} formOptions={formOptions} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function txVisuals(tx: Tx) {
  const Icon = tx.isInitialBalance
    ? Minus
    : tx.type === "INCOME"
      ? ArrowUpRight
      : tx.type === "EXPENSE"
      ? ArrowDownRight
      : ArrowLeftRight;
  const color = tx.isInitialBalance
    ? "text-foreground"
    : tx.type === "INCOME"
      ? "text-emerald-400"
      : tx.type === "EXPENSE"
      ? "text-red-400"
      : "text-blue-400";
  const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "−" : "";
  const label = tx.isAdjustment
    ? "Ajuste"
    : tx.type === "INCOME"
    ? "Ingreso"
    : tx.type === "EXPENSE"
    ? "Gasto"
    : "Transferencia";
  return { Icon, color, sign, label };
}

/**
 * Icono del movimiento: el de su categoría si tiene una; si no (o si es una
 * transferencia o un ajuste), el de su tipo.
 */
function TxIcon({
  tx,
  Icon,
  color,
  className,
}: {
  tx: Tx;
  Icon: ReturnType<typeof txVisuals>["Icon"];
  color: string;
  className?: string;
}) {
  if (tx.categoryName && !tx.isAdjustment && tx.type !== "TRANSFER") {
    return (
      <CategoryIcon icon={tx.categoryIcon} color={tx.categoryColor} className={className} />
    );
  }
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary ${
        className ?? ""
      }`}
    >
      <Icon className={`h-4 w-4 ${color}`} />
    </div>
  );
}

/** Movimiento en una tarjeta compacta (vista móvil) */
function TransactionCard({
  tx,
  formOptions,
}: {
  tx: Tx;
  formOptions: TransactionFormOptions;
}) {
  const { Icon, color, sign, label } = txVisuals(tx);
  return (
    <div className="flex gap-3 p-3">
      <TxIcon tx={tx} Icon={Icon} color={color} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-medium">{tx.description}</p>
          <p className={`shrink-0 text-sm font-semibold tabular-nums ${color}`}>
            {sign}
            {formatCurrency(tx.amount)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatShortDate(tx.date)} · {formatTime(tx.date)} · {tx.accountName}
          {tx.transferAccountName && <> → {tx.transferAccountName}</>}
          {tx.isAdjustment && <> · {label}</>}
        </p>
        <TxTags tx={tx} />
      </div>
      {/* Ancho fijo: los montos quedan alineados aunque no haya acción */}
      <div className="-mr-1 w-8 shrink-0 self-center">
        <RowActions tx={tx} formOptions={formOptions} />
      </div>
    </div>
  );
}

/** Categoría, MSI, suscripción y recibos del movimiento */
function TxTags({ tx, className }: { tx: Tx; className?: string }) {
  const hasTags =
    tx.categoryName ||
    tx.category ||
    tx.isMsi ||
    tx.subscriptionName ||
    tx.attachmentCount > 0;
  if (!hasTags) return null;
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className ?? ""}`}>
      {tx.categoryName && (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
          style={{
            backgroundColor: tx.categoryColor ? `${tx.categoryColor}20` : undefined,
            color: tx.categoryColor ?? undefined,
            borderColor: tx.categoryColor ? `${tx.categoryColor}50` : undefined,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: tx.categoryColor ?? "#71717a" }}
          />
          {tx.categoryName}
        </span>
      )}
      {tx.category && !tx.categoryName && (
        <Badge variant="secondary" className="text-xs">
          {tx.category}
        </Badge>
      )}
      {tx.isMsi && !tx.msiParentId && (
        <Badge variant="warning" className="text-xs">
          MSI {tx.msiInstallments}x
        </Badge>
      )}
      {tx.isMsi && tx.msiParentId && (
        <Badge variant="outline" className="text-xs">
          MSI {tx.msiInstallments}x
        </Badge>
      )}
      {tx.subscriptionName && (
        <Badge variant="secondary" className="text-xs">
          {tx.subscriptionName}
        </Badge>
      )}
      {tx.attachmentCount > 0 && (
        <AttachmentsViewer
          transactionId={tx.id}
          description={tx.description}
          count={tx.attachmentCount}
        />
      )}
    </div>
  );
}

/**
 * - Movimiento normal: editar (el formulario también permite eliminar)
 * - MSI: solo eliminar; editarlo implicaría recalcular las mensualidades
 * - Ajuste o balance inicial: sin acciones, los genera la cuenta
 */
function RowActions({
  tx,
  formOptions,
}: {
  tx: Tx;
  formOptions: TransactionFormOptions;
}) {
  if (tx.isAdjustment) return null;
  if (tx.isMsi) return <DeleteMsiButton tx={tx} />;

  const transaction: EditableTransaction = {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    date: tx.date,
    description: tx.description,
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    transferAccountId: tx.transferAccountId,
    isMsi: tx.isMsi,
    msiInstallments: tx.msiInstallments,
  };

  return (
    <TransactionActions mode="edit" {...formOptions} transaction={transaction}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Editar ${tx.description}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </TransactionActions>
  );
}

function DeleteMsiButton({ tx }: { tx: Tx }) {
  const router = useRouter();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const [isPending, startTransition] = useTransition();
  const isParent = !tx.msiParentId;

  async function onDelete() {
    const ok = await confirm({
      title: isParent
        ? "¿Eliminar la compra a MSI?"
        : "¿Eliminar esta mensualidad?",
      description: isParent
        ? `Se eliminarán "${tx.description}" y todas sus mensualidades. Esta acción no se puede deshacer.`
        : `Se eliminará esta mensualidad de "${tx.description}". Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showAlert({
          title: "No se pudo eliminar",
          description: data.error || "Error al eliminar",
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={onDelete}
      disabled={isPending}
      aria-label={`Eliminar ${tx.description}`}
      title="Las compras a MSI no se editan; elimínala y créala de nuevo"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

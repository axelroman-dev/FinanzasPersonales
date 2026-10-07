"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Tag } from "lucide-react";
import { CategorySelect } from "@/components/shared/category-select";
import { AccountSelect, type AccountOption } from "@/components/shared/account-select";
import { toDateTimeLocalValue } from "@/lib/utils";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { AttachmentsField, uploadAttachments } from "./attachments-field";
import { useAlert, useConfirm } from "@/components/shared/confirm-dialog";
import type { NewTransactionDefaults } from "@/lib/transaction-defaults";

type CreditAccount = { id: string; name: string; creditLimit: number | null };
type SubOpt = { id: string; name: string; amount: number; categoryId: string | null };

type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  parentId: string | null;
  children: CategoryNode[];
};

/** Opciones que necesita el formulario (las arma la página de movimientos) */
export type TransactionFormOptions = {
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  subscriptions?: SubOpt[];
  categories?: CategoryNode[];
  /** false si falta ATTACHMENTS_KEY: no se muestra la sección de recibos */
  attachmentsEnabled?: boolean;
};

/** Datos de un movimiento existente para editarlo */
export type EditableTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  date: string;
  description: string;
  categoryId: string | null;
  accountId: string;
  transferAccountId: string | null;
  subscriptionId: string | null;
  isMsi: boolean;
  msiInstallments: number | null;
};

export function TransactionActions({
  mode,
  accounts,
  creditAccounts,
  subscriptions,
  categories,
  attachmentsEnabled,
  transaction,
  defaults,
  children,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  subscriptions?: SubOpt[];
  categories?: CategoryNode[];
  attachmentsEnabled?: boolean;
  transaction?: EditableTransaction;
  /** Solo al crear: valores iniciales (p. ej. los filtros de la lista) */
  defaults?: NewTransactionDefaults;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <TxFormDialog
        key={formKey}
        mode={mode}
        accounts={accounts}
        creditAccounts={creditAccounts}
        subscriptions={subscriptions}
        categories={categories}
        attachmentsEnabled={attachmentsEnabled}
        transaction={transaction}
        defaults={defaults}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Dialog>
  );
}

function TxFormDialog({
  mode,
  accounts,
  creditAccounts,
  subscriptions,
  categories,
  attachmentsEnabled,
  transaction,
  defaults,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  creditAccounts: CreditAccount[];
  subscriptions?: SubOpt[];
  categories?: CategoryNode[];
  attachmentsEnabled?: boolean;
  transaction?: EditableTransaction;
  defaults?: NewTransactionDefaults;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Archivos elegidos que se suben al guardar
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(
    transaction?.type ?? defaults?.type ?? "EXPENSE"
  );
  const [amount, setAmount] = useState<number | "">(
    transaction ? Math.abs(Number(transaction.amount)) : ""
  );
  // Fecha y hora en la zona del navegador ("YYYY-MM-DDTHH:mm")
  const [date, setDate] = useState(
    toDateTimeLocalValue(transaction?.date ?? new Date())
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(
    transaction?.categoryId ?? defaults?.categoryId ?? ""
  );
  // Sin cuenta preseleccionada: con varias hay que elegirla (salvo que venga
  // del filtro); con una sola no hay nada que elegir
  const [accountId, setAccountId] = useState(
    transaction?.accountId ??
      defaults?.accountId ??
      (accounts.length === 1 ? accounts[0].id : "")
  );
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transferAccountId ?? ""
  );

  // MSI
  const [isMsi, setIsMsi] = useState(transaction?.isMsi ?? defaults?.isMsi ?? false);
  const [msiInstallments, setMsiInstallments] = useState<number | "">(
    transaction?.msiInstallments ?? 3
  );

  // Suscripción
  const [subscriptionId, setSubscriptionId] = useState<string>(
    transaction?.subscriptionId ?? ""
  );

  // Solo permitir MSI si es gasto en crédito
  const canMsi = type === "EXPENSE" && creditAccounts.some((c) => c.id === accountId);

  // Las categorías dependen del tipo: al cambiarlo, la elegida ya no aplica
  function onTypeChange(next: "INCOME" | "EXPENSE" | "TRANSFER") {
    if (next !== type) setCategoryId("");
    // Solo los gastos pueden ser pago de una suscripción
    if (next !== "EXPENSE") setSubscriptionId("");
    setType(next);
  }

  // Al elegir una suscripción, usar su categoría si aún no hay una
  function onSubscriptionChange(id: string) {
    setSubscriptionId(id);
    const sub = subscriptions?.find((s) => s.id === id);
    if (sub?.categoryId && !categoryId) setCategoryId(sub.categoryId);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!accountId) {
      setError(type === "TRANSFER" ? "Selecciona la cuenta origen" : "Selecciona la cuenta");
      return;
    }
    if (type === "TRANSFER" && !transferAccountId) {
      setError("Selecciona la cuenta destino");
      return;
    }
    if (type === "TRANSFER" && transferAccountId === accountId) {
      setError("Las cuentas deben ser distintas");
      return;
    }

    startTransition(async () => {
      try {
        const body: any = {
          type,
          amount: Number(amount),
          // Instante exacto (con zona): el servidor no sabe la hora local
          date: new Date(date).toISOString(),
          description,
          categoryId: type === "TRANSFER" ? null : (categoryId || null),
          accountId,
          transferAccountId: type === "TRANSFER" ? transferAccountId : null,
          subscriptionId: subscriptionId || null,
        };

        if (mode === "create" && isMsi && canMsi) {
          body.isMsi = true;
          body.msiInstallments = Number(msiInstallments);
        }

        const url =
          mode === "create"
            ? "/api/transactions"
            : `/api/transactions/${transaction!.id}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al guardar");
          return;
        }

        // Los adjuntos necesitan el id: se suben después de guardar. En una
        // compra a MSI van en la compra (parent), no en las mensualidades
        const savedId: string = data.parent?.id ?? data.id;
        const uploadError = await uploadAttachments(savedId, pendingFiles);
        onSaved();
        router.refresh();
        if (uploadError) {
          showAlert({
            title: "Los recibos no se subieron",
            description: `El movimiento se guardó, pero los recibos no: ${uploadError}`,
          });
        }
      } catch {
        setError("Error al guardar");
      }
    });
  }

  async function onDelete() {
    if (!transaction) return;
    const ok = await confirm({
      title: "¿Eliminar este movimiento?",
      description: `"${transaction.description}" se eliminará. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
        router.refresh();
      }
    });
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nuevo movimiento" : "Editar movimiento"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => onTypeChange(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Gasto</SelectItem>
              <SelectItem value="INCOME">Ingreso</SelectItem>
              <SelectItem value="TRANSFER">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Fecha y hora</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Comida, salario, etc."
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Cuenta {type === "TRANSFER" ? "origen" : ""}</Label>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              if (id === transferAccountId) setTransferAccountId("");
            }}
          />
        </div>

        {type === "TRANSFER" && (
          <div className="space-y-2">
            <Label>Cuenta destino</Label>
            <AccountSelect
              accounts={accounts}
              value={transferAccountId}
              onChange={setTransferAccountId}
              placeholder="Selecciona cuenta destino"
              excludeId={accountId}
            />
          </div>
        )}

        {type === "EXPENSE" && subscriptions && subscriptions.length > 0 && (
          <div className="space-y-2">
            <Label>Suscripción (opcional)</Label>
            <Select
              value={subscriptionId || "none"}
              onValueChange={(v) => onSubscriptionChange(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin suscripción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin suscripción</SelectItem>
                {subscriptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} (${s.amount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si este gasto es el pago de una suscripción, elígela: queda
              marcada como pagada este mes y el balance no la vuelve a restar.
            </p>
          </div>
        )}

        {mode === "create" && canMsi && (
          <div className="rounded-md border border-dashed p-3 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isMsi"
                checked={isMsi}
                onCheckedChange={(c) => setIsMsi(!!c)}
              />
              <Label htmlFor="isMsi" className="text-sm cursor-pointer">
                Compra a Meses Sin Intereses (MSI)
              </Label>
            </div>
            {isMsi && (
              <div className="space-y-2">
                <Label htmlFor="msiInstallments">Número de mensualidades</Label>
                <Input
                  id="msiInstallments"
                  type="number"
                  min={2}
                  max={48}
                  value={msiInstallments}
                  onChange={(e) =>
                    setMsiInstallments(
                      e.target.value === "" ? "" : parseInt(e.target.value)
                    )
                  }
                />
                {amount && msiInstallments && Number(msiInstallments) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Se crearán {msiInstallments} mensualidades de $
                    {(Number(amount) / Number(msiInstallments)).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Categoría (opcional)
          </Label>
          <CategorySelect
            categories={categories ?? []}
            kind={type === "INCOME" ? "INCOME" : "EXPENSE"}
            value={categoryId}
            onChange={setCategoryId}
            disabled={type === "TRANSFER"}
          />
        </div>

        {attachmentsEnabled && (
          <AttachmentsField
            transactionId={transaction?.id}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogActions className="justify-between">
          {mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </DialogActions>
      </form>
    </DialogContent>
  );
}
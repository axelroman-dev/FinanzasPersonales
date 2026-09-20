"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
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
import { Loader2, Trash2 } from "lucide-react";

type AccountOpt = { id: string; name: string; type: string };
type CreditAccount = { id: string; name: string; creditLimit: number | null };
type SubOpt = { id: string; name: string; amount: number };

export function TransactionActions({
  mode,
  accounts,
  creditAccounts,
  subscriptions,
  transaction,
  children,
}: {
  mode: "create" | "edit";
  accounts: AccountOpt[];
  creditAccounts: CreditAccount[];
  subscriptions?: SubOpt[];
  transaction?: any;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <TxFormDialog
        mode={mode}
        accounts={accounts}
        creditAccounts={creditAccounts}
        subscriptions={subscriptions}
        transaction={transaction}
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
  transaction,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  accounts: AccountOpt[];
  creditAccounts: CreditAccount[];
  subscriptions?: SubOpt[];
  transaction?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(
    transaction?.type ?? "EXPENSE"
  );
  const [amount, setAmount] = useState<number | "">(
    transaction ? Math.abs(Number(transaction.amount)) : ""
  );
  const [date, setDate] = useState(
    transaction?.date
      ? new Date(transaction.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [category, setCategory] = useState(transaction?.category ?? "");
  const [accountId, setAccountId] = useState(
    transaction?.accountId ?? accounts[0]?.id ?? ""
  );
  const [transferAccountId, setTransferAccountId] = useState(
    transaction?.transferAccountId ?? ""
  );

  // MSI
  const [isMsi, setIsMsi] = useState(transaction?.isMsi ?? false);
  const [msiInstallments, setMsiInstallments] = useState<number | "">(
    transaction?.msiInstallments ?? 3
  );

  // Suscripción
  const [subscriptionId, setSubscriptionId] = useState<string>(
    transaction?.subscriptionId ?? ""
  );

  // Solo permitir MSI si es gasto en crédito
  const canMsi = type === "EXPENSE" && creditAccounts.some((c) => c.id === accountId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
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
          date,
          description,
          category: category || null,
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
            : `/api/transactions/${transaction.id}`;
        const method = mode === "create" ? "POST" : "PATCH";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Error al guardar");
          return;
        }

        onSaved();
        router.refresh();
      } catch {
        setError("Error al guardar");
      }
    });
  }

  async function onDelete() {
    if (!transaction) return;
    if (!confirm("¿Eliminar este movimiento?")) return;
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

  // Cuentas disponibles para transferir (excluyendo la origen)
  const transferOptions = accounts.filter((a) => a.id !== accountId);

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
          <Select value={type} onValueChange={(v) => setType(v as any)}>
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

        <div className="grid grid-cols-2 gap-3">
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
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
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
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "TRANSFER" && (
          <div className="space-y-2">
            <Label>Cuenta destino</Label>
            <Select
              value={transferAccountId}
              onValueChange={setTransferAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta destino" />
              </SelectTrigger>
              <SelectContent>
                {transferOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === "EXPENSE" && subscriptions && subscriptions.length > 0 && (
          <div className="space-y-2">
            <Label>Suscripción (opcional)</Label>
            <Select
              value={subscriptionId || "none"}
              onValueChange={(v) => setSubscriptionId(v === "none" ? "" : v)}
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
          <Label htmlFor="category">Categoría (opcional)</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Alimentos, Transporte, etc."
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
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
        </div>
      </form>
    </DialogContent>
  );
}
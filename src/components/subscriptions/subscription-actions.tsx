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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import {
  CategorySelect,
  type CategoryOption,
} from "@/components/shared/category-select";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { AccountSelect, type AccountOption } from "@/components/shared/account-select";

type SubFormData = {
  id: string;
  name: string;
  amount: number;
  billingDay: number;
  frequency: Frequency;
  billingMonth: number | null;
  categoryId: string | null;
  isActive: boolean;
  accountId: string;
};

type Frequency = "MONTHLY" | "YEARLY";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date(2000, i, 1))
);

export function SubscriptionActions({
  mode,
  accounts,
  categories,
  subscription,
  children,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  categories: CategoryOption[];
  subscription?: SubFormData;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <SubFormDialog
        key={formKey}
        mode={mode}
        accounts={accounts}
        categories={categories}
        subscription={subscription}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Dialog>
  );
}

function SubFormDialog({
  mode,
  accounts,
  categories,
  subscription,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  accounts: AccountOption[];
  categories: CategoryOption[];
  subscription?: SubFormData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(subscription?.name ?? "");
  const [amount, setAmount] = useState<number | "">(subscription?.amount ?? "");
  const [billingDay, setBillingDay] = useState<number | "">(
    subscription?.billingDay ?? 1
  );
  const [frequency, setFrequency] = useState<Frequency>(subscription?.frequency ?? "MONTHLY");
  // Mes de cobro de las anuales (1-12); por defecto el actual
  const [billingMonth, setBillingMonth] = useState<number>(
    subscription?.billingMonth ?? new Date().getMonth() + 1
  );
  const [categoryId, setCategoryId] = useState(subscription?.categoryId ?? "");
  const [isActive, setIsActive] = useState(subscription?.isActive ?? true);
  // Igual que en movimientos: con una sola cuenta se elige sola; con varias
  // hay que seleccionarla
  const [accountId, setAccountId] = useState(
    subscription?.accountId ?? (accounts.length === 1 ? accounts[0].id : "")
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) {
      setError("Selecciona la cuenta donde se cobra");
      return;
    }
    startTransition(async () => {
      try {
        const body = {
          name,
          amount: Number(amount),
          billingDay: Number(billingDay),
          frequency,
          billingMonth: frequency === "YEARLY" ? billingMonth : null,
          categoryId: categoryId || null,
          isActive,
          accountId,
        };
        const url =
          mode === "create"
            ? "/api/subscriptions"
            : `/api/subscriptions/${subscription!.id}`;
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
    if (!subscription) return;
    const ok = await confirm({
      title: "¿Eliminar esta suscripción?",
      description: `"${subscription.name}" dejará de contarse en tus pagos recurrentes. Los movimientos ya registrados se conservan.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
        router.refresh();
      }
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nueva suscripción" : "Editar suscripción"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Netflix"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Frecuencia</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
                <SelectItem value="YEARLY">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">
              {frequency === "YEARLY" ? "Monto anual" : "Monto mensual"}
            </Label>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          {frequency === "YEARLY" && (
            <div className="space-y-2">
              <Label>Mes de cobro</Label>
              <Select
                value={String(billingMonth)}
                onValueChange={(v) => setBillingMonth(Number(v))}
              >
                <SelectTrigger className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)} className="capitalize">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="billingDay">Día de cobro</Label>
            <Input
              id="billingDay"
              type="number"
              min={1}
              max={31}
              value={billingDay}
              onChange={(e) =>
                setBillingDay(
                  e.target.value === "" ? "" : parseInt(e.target.value)
                )
              }
              required
            />
          </div>
        </div>

        <p className="-mt-1 text-xs text-muted-foreground">
          Se registra sola como gasto {frequency === "YEARLY" ? "cada año" : "cada mes"} en
          esa fecha. Si el mes no tiene ese día, se cobra el último.
        </p>

        <div className="space-y-2">
          <Label>Cuenta donde se cobra</Label>
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
          />
        </div>

        <div className="space-y-2">
          <Label>Categoría (opcional)</Label>
          <CategorySelect
            categories={categories}
            kind="EXPENSE"
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>

        {mode === "edit" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(c) => setIsActive(!!c)}
            />
            <Label htmlFor="isActive" className="text-sm cursor-pointer">
              Suscripción activa
            </Label>
          </div>
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
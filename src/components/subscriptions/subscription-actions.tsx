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
type SubFormData = {
  id: string;
  name: string;
  amount: number;
  billingDay: number;
  category: string | null;
  isActive: boolean;
  accountId: string;
};

export function SubscriptionActions({
  mode,
  accounts,
  subscription,
  children,
}: {
  mode: "create" | "edit";
  accounts: AccountOpt[];
  subscription?: SubFormData;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <SubFormDialog
        mode={mode}
        accounts={accounts}
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
  subscription,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  accounts: AccountOpt[];
  subscription?: SubFormData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(subscription?.name ?? "");
  const [amount, setAmount] = useState<number | "">(subscription?.amount ?? "");
  const [billingDay, setBillingDay] = useState<number | "">(
    subscription?.billingDay ?? 1
  );
  const [category, setCategory] = useState(subscription?.category ?? "");
  const [isActive, setIsActive] = useState(subscription?.isActive ?? true);
  const [accountId, setAccountId] = useState(
    subscription?.accountId ?? accounts[0]?.id ?? ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const body = {
          name,
          amount: Number(amount),
          billingDay: Number(billingDay),
          category: category || null,
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
    if (!confirm("¿Eliminar esta suscripción?")) return;
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
            <Label htmlFor="amount">Monto mensual</Label>
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

        <div className="space-y-2">
          <Label>Cuenta donde se cobra</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría (opcional)</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Entretenimiento"
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
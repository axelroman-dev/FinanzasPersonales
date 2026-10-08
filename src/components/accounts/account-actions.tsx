"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogActionGroup,
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
import { Trash2, Loader2, Pencil } from "lucide-react";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { useConfirm } from "@/components/shared/confirm-dialog";

type AccountFormData = {
  id: string;
  name: string;
  type: "DEBIT" | "CREDIT" | "SAVINGS" | "VOUCHER";
  balance: number;
  currency: string;
  includeInBalance: boolean;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDay: number | null;
};

export function AccountActions({
  mode,
  account,
  children,
}: {
  mode: "create" | "edit";
  account?: AccountFormData;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <AccountFormDialog
        key={formKey}
        mode={mode}
        account={account}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </Dialog>
  );
}

function AccountFormDialog({
  mode,
  account,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  account?: AccountFormData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountFormData["type"]>(
    account?.type ?? "DEBIT"
  );
  const [balance, setBalance] = useState(account?.balance ?? 0);
  const [currency, setCurrency] = useState(account?.currency ?? "MXN");
  const [includeInBalance, setIncludeInBalance] = useState(
    account?.includeInBalance ?? true
  );
  const [creditLimit, setCreditLimit] = useState<number | "">(
    account?.creditLimit ?? ""
  );
  const [cutoffDay, setCutoffDay] = useState<number | "">(
    account?.cutoffDay ?? ""
  );
  const [paymentDay, setPaymentDay] = useState<number | "">(
    account?.paymentDay ?? ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const body = {
          name,
          type,
          balance: Number(balance),
          currency,
          includeInBalance,
          creditLimit: type === "CREDIT" ? Number(creditLimit) || null : null,
          cutoffDay: type === "CREDIT" ? Number(cutoffDay) || null : null,
          paymentDay: type === "CREDIT" ? Number(paymentDay) || null : null,
        };

        const url =
          mode === "create" ? "/api/accounts" : `/api/accounts/${account!.id}`;
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
      } catch {
        setError("Error al guardar");
      }
    });
  }

  async function onDelete() {
    if (!account) return;

    // Cuánto se perdería, para avisarlo antes de confirmar
    const check = await fetch(`/api/accounts/${account.id}?check=true`, {
      method: "DELETE",
    });
    if (!check.ok) {
      setError("Error al eliminar");
      return;
    }
    const usage = await check.json();
    const lines = [
      usage.ownTxCount > 0 && `Se borrarán sus ${usage.ownTxCount} movimiento(s).`,
      usage.transferCount > 0 &&
        `Sus ${usage.transferCount} transferencia(s) con otras cuentas se conservan en esas cuentas como ingreso o gasto (sus saldos no cambian).`,
      usage.subCount > 0 && `Se borrarán sus ${usage.subCount} suscripción(es).`,
    ].filter((l): l is string => !!l);

    // Siempre se confirma escribiendo el nombre: no debe bastar un clic
    const ok = await confirm({
      title: `¿Eliminar la cuenta "${account.name}"?`,
      description: (
        <>
          {lines.length > 0 && (
            <ul className="list-disc space-y-1 pl-4">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <p>Esta acción no se puede deshacer.</p>
        </>
      ),
      confirmLabel: "Eliminar cuenta",
      destructive: true,
      confirmText: account.name,
    });
    if (!ok) return;

    startTransition(async () => {
      // force: el usuario ya confirmó lo que se borra
      const res = await fetch(`/api/accounts/${account.id}?force=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        onSaved();
      } else {
        setError("Error al eliminar");
      }
    });
  }

  const isVoucher = type === "VOUCHER";

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nueva cuenta" : "Editar cuenta"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. BBVA Débito"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBIT">Débito</SelectItem>
                <SelectItem value="CREDIT">Crédito</SelectItem>
                <SelectItem value="SAVINGS">Ahorro</SelectItem>
                <SelectItem value="VOUCHER">Vale de despensa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="balance">
            {type === "CREDIT" ? "Deuda actual" : "Balance"}
          </Label>
          <Input
            id="balance"
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
            required
          />
          <p className="text-xs text-muted-foreground">
            {mode === "create"
              ? "Se registrará como movimiento de «Balance inicial»."
              : "Si lo cambias, la diferencia se registrará como «Ajuste de cuenta»."}
          </p>
        </div>

        {type === "CREDIT" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Límite de crédito</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                value={creditLimit}
                onChange={(e) =>
                  setCreditLimit(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cutoffDay">Día de corte</Label>
                <Input
                  id="cutoffDay"
                  type="number"
                  min={1}
                  max={31}
                  value={cutoffDay}
                  onChange={(e) =>
                    setCutoffDay(e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDay">Día de pago</Label>
                <Input
                  id="paymentDay"
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDay}
                  onChange={(e) =>
                    setPaymentDay(e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                  placeholder="5"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeInBalance"
            checked={includeInBalance}
            onCheckedChange={(c) => setIncludeInBalance(!!c)}
            disabled={isVoucher}
          />
          <Label htmlFor="includeInBalance" className="text-sm cursor-pointer">
            Incluir en el balance
            {isVoucher && (
              <span className="text-muted-foreground ml-1">
                (los vales no cuentan)
              </span>
            )}
          </Label>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogActions className="justify-between">
          {mode === "edit" && (
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
          )}
          <DialogActionGroup>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </DialogActionGroup>
        </DialogActions>
      </form>
    </DialogContent>
  );
}

/**
 * Botón compacto de edición para mostrar en cada card de cuenta.
 * Reutiliza el formulario de edición.
 */
export function AccountEditButton({ account }: { account: AccountFormData }) {
  return (
    <AccountActions mode="edit" account={account}>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar cuenta">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </AccountActions>
  );
}
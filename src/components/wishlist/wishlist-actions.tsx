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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { normalizeUrl } from "@/lib/wishlist";
import { formatCurrency } from "@/lib/utils";

export type WishlistFormData = {
  id: string;
  name: string;
  url: string | null;
  price: number;
  currency: string;
  targetPrice: number | null;
  purchased: boolean;
};

export function WishlistActions({
  mode,
  currencies,
  item,
  children,
}: {
  mode: "create" | "edit";
  /** Monedas del usuario (la principal primero) */
  currencies: string[];
  item?: WishlistFormData;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <WishlistFormDialog
        key={formKey}
        mode={mode}
        currencies={currencies}
        item={item}
        onClose={() => setOpen(false)}
      />
    </Dialog>
  );
}

function WishlistFormDialog({
  mode,
  currencies,
  item,
  onClose,
}: {
  mode: "create" | "edit";
  currencies: string[];
  item?: WishlistFormData;
  onClose: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [price, setPrice] = useState<number | "">(item?.price ?? "");
  const [currency, setCurrency] = useState(item?.currency ?? currencies[0]);
  const [targetPrice, setTargetPrice] = useState<number | "">(item?.targetPrice ?? "");
  const [purchased, setPurchased] = useState(item?.purchased ?? false);
  const currencyOptions = [...new Set([...currencies, currency])];
  const priceChanged = mode === "edit" && price !== "" && price !== item?.price;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (url.trim() && !normalizeUrl(url)) {
      setError("El link no es válido");
      return;
    }
    startTransition(async () => {
      try {
        const body = {
          name,
          url: url.trim() || null,
          price: Number(price),
          currency,
          targetPrice: targetPrice === "" ? null : Number(targetPrice),
          ...(mode === "edit" && { purchased }),
        };
        const res = await fetch(
          mode === "create" ? "/api/wishlist" : `/api/wishlist/${item!.id}`,
          {
            method: mode === "create" ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Error al guardar");
          return;
        }
        onClose();
        router.refresh();
      } catch {
        setError("Error al guardar");
      }
    });
  }

  async function onDelete() {
    if (!item) return;
    const ok = await confirm({
      title: "¿Eliminar de la wishlist?",
      description: `"${item.name}" se quitará de tu wishlist.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Agregar a la wishlist" : "Editar producto"}</DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wish-url">Link (opcional)</Label>
          <Input
            id="wish-url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Pega el link de Amazon, MercadoLibre…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wish-name">Producto</Label>
          <Input
            id="wish-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Audífonos Sony WH-1000XM5"
            maxLength={200}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="wish-price">Precio actual</Label>
            <div className="flex gap-2">
              <Input
                id="wish-price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                required
              />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24 shrink-0" aria-label="Moneda del precio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wish-target">Precio objetivo (opcional)</Label>
            <Input
              id="wish-target"
              type="number"
              step="0.01"
              min="0.01"
              value={targetPrice}
              onChange={(e) =>
                setTargetPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
            />
          </div>
        </div>

        <p className="-mt-1 text-xs text-muted-foreground">
          {priceChanged
            ? `Se guardará ${formatCurrency(item!.price, item!.currency)} como precio anterior para ver cuánto cambió.`
            : "Cuando el precio llegue a tu objetivo, se marca en la lista."}
        </p>

        {mode === "edit" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="wish-purchased"
              checked={purchased}
              onCheckedChange={(c) => setPurchased(!!c)}
            />
            <Label htmlFor="wish-purchased" className="text-sm cursor-pointer">
              Ya lo compré (deja de sumar al total)
            </Label>
          </div>
        )}

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
              {mode === "create" ? "Agregar" : "Guardar"}
            </Button>
          </DialogActionGroup>
        </DialogActions>
      </form>
    </DialogContent>
  );
}

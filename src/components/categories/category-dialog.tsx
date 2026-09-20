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
import { Loader2 } from "lucide-react";

type CatFormData = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  color: string | null;
  icon: string | null;
  parentId: string | null;
};

const COLOR_PRESETS = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#06b6d4",
  "#64748b",
  "#22c55e",
  "#84cc16",
  "#71717a",
  "#ef4444",
];

export function CategoryDialog({
  mode,
  category,
  parentId,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnChange,
}: {
  mode: "create" | "edit";
  category?: CatFormData;
  parentId?: string | null;
  children?: React.ReactNode;
  /** Si se pasa, el dialog se controla externamente (sin trigger interno) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(value: boolean) {
    if (isControlled) {
      controlledOnChange?.(value);
    } else {
      setInternalOpen(value);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <CatFormDialog
        mode={mode}
        category={category}
        parentId={parentId}
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </Dialog>
  );
}

function CatFormDialog({
  mode,
  category,
  parentId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  category?: CatFormData;
  parentId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CatFormData["kind"]>(category?.kind ?? "EXPENSE");
  const [color, setColor] = useState<string | null>(
    category?.color ?? COLOR_PRESETS[0]
  );

  const isSubcategory = mode === "create" && !!parentId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const body: any = {
          name,
          kind,
          color,
          icon: null,
        };
        if (mode === "create") {
          body.parentId = parentId ?? null;
        }

        const url =
          mode === "create"
            ? "/api/categories"
            : `/api/categories/${category!.id}`;
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

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create"
            ? isSubcategory
              ? "Nueva subcategoría"
              : "Nueva categoría"
            : "Editar categoría"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isSubcategory ? "Ej. Restaurantes" : "Ej. Alimentación"}
            required
            autoFocus
          />
        </div>

        {!isSubcategory && (
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Gasto</SelectItem>
                <SelectItem value="INCOME">Ingreso</SelectItem>
                <SelectItem value="BOTH">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-all ${
                  color === c
                    ? "border-foreground scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
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
import { Loader2 } from "lucide-react";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { CATEGORY_KIND_LABEL, type CategoryKind } from "@/lib/category-kind";
import { CategoryIcon } from "@/components/shared/category-icon";
import { IconPicker } from "./icon-picker";

type CatFormData = {
  id: string;
  name: string;
  kind: CategoryKind;
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

/** Color e icono de la principal: la subcategoría usa ese color */
type ParentInfo = { color: string | null; icon: string | null };

export function CategoryDialog({
  mode,
  category,
  parentId,
  parent,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnChange,
}: {
  mode: "create" | "edit";
  category?: CatFormData;
  parentId?: string | null;
  /** Solo para subcategorías */
  parent?: ParentInfo;
  children?: React.ReactNode;
  /** Si se pasa, el dialog se controla externamente (sin trigger interno) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const formKey = useFormResetKey(open);

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
        key={formKey}
        mode={mode}
        category={category}
        parentId={parentId}
        parent={parent}
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
  parent,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  category?: CatFormData;
  parentId?: string | null;
  parent?: ParentInfo;
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

  // Las subcategorías heredan el tipo y el color del padre: no se eligen
  const isSubcategory =
    mode === "create" ? !!parentId : !!category?.parentId;
  // Una subcategoría nueva arranca con el icono de su principal
  const [icon, setIcon] = useState<string | null>(
    category?.icon ?? (isSubcategory ? parent?.icon ?? null : null) ?? "category"
  );
  const shownColor = (isSubcategory ? parent?.color : color) ?? "#71717a";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const body: any = { name, icon };
        if (!isSubcategory) {
          body.kind = kind;
          body.color = color;
        }
        if (mode === "create") body.parentId = parentId ?? null;

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
            : isSubcategory
              ? "Editar subcategoría"
              : "Editar categoría"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <div className="flex items-center gap-2">
            <CategoryIcon icon={icon} color={shownColor} size="lg" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSubcategory ? "Ej. Restaurantes" : "Ej. Alimentación"}
              required
              autoFocus
            />
          </div>
        </div>

        {!isSubcategory && (
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CategoryKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">{CATEGORY_KIND_LABEL.EXPENSE}</SelectItem>
                <SelectItem value="INCOME">{CATEGORY_KIND_LABEL.INCOME}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {!isSubcategory && (
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
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">
                Sus subcategorías usan este mismo color
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Icono</Label>
          <IconPicker value={icon} onChange={setIcon} color={shownColor} />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogActions className="justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </DialogActions>
      </form>
    </DialogContent>
  );
}
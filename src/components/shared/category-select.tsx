"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/shared/category-icon";

export type CategoryOption = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  children: { id: string; name: string; icon: string | null }[];
};

/**
 * Selector de categoría: cada categoría principal es un título que agrupa
 * (no se puede elegir) y debajo van sus subcategorías con su icono. El valor
 * elegido se muestra como "Principal › Subcategoría". Solo muestra las del
 * tipo dado.
 */
export function CategorySelect({
  categories,
  kind,
  value,
  onChange,
  disabled,
}: {
  categories: CategoryOption[];
  kind: "INCOME" | "EXPENSE";
  /** id de la subcategoría, o "" para ninguna */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const options = categories.filter((c) => c.kind === kind);

  // Texto del valor elegido: la subcategoría sola no dice de qué principal es.
  // Un movimiento viejo puede estar asignado a la principal: se muestra igual.
  let selected: { label: string; icon: string | null; color: string | null } | undefined;
  for (const cat of options) {
    if (cat.id === value) selected = { label: cat.name, icon: cat.icon, color: cat.color };
    const sub = cat.children.find((c) => c.id === value);
    if (sub) {
      selected = {
        label: `${cat.name} › ${sub.name}`,
        icon: sub.icon ?? cat.icon,
        color: cat.color,
      };
    }
  }

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Sin categoría">
          {selected && (
            <span className="flex min-w-0 items-center gap-2">
              <CategoryIcon icon={selected.icon} color={selected.color} size="sm" />
              <span className="truncate">{selected.label}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin categoría</SelectItem>
        {options.map((cat) => (
          <SelectGroup key={cat.id} className="mt-1 border-t pt-1">
            <SelectLabel className="flex items-center gap-2 font-medium text-foreground">
              <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
              {cat.name}
            </SelectLabel>
            {cat.children.length === 0 && (
              <p className="py-1 pl-10 pr-2 text-xs italic text-muted-foreground">
                Sin subcategorías
              </p>
            )}
            {cat.children.map((sub) => (
              <SelectItem key={sub.id} value={sub.id} className="pl-10">
                <span className="flex items-center gap-2">
                  <CategoryIcon icon={sub.icon ?? cat.icon} color={cat.color} size="sm" />
                  {sub.name}
                </span>
              </SelectItem>
            ))}
            {/* Asignado a la principal (movimiento viejo): opción oculta para
                que el valor se siga mostrando */}
            {cat.id === value && (
              <SelectItem value={cat.id} className="hidden">
                {cat.name}
              </SelectItem>
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

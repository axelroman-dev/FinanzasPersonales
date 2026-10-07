"use client";

import { Combobox, type ComboboxGroup } from "@/components/ui/combobox";
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
 * Selector de categoría con búsqueda: cada categoría principal es un título
 * que agrupa (no se puede elegir) y debajo van sus subcategorías con su
 * icono. Se puede escribir para filtrar por subcategoría o por principal
 * ("comida" muestra todas las de Alimentación si así se llama alguna). El
 * valor elegido se muestra como "Principal › Subcategoría". Solo muestra las
 * del tipo dado.
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

  const groups: ComboboxGroup[] = [
    { key: "none", options: [{ value: "", label: "Sin categoría" }] },
    ...options.map((cat) => ({
      key: cat.id,
      className: "mt-1 border-t pt-1",
      heading: (
        <span className="flex items-center gap-2 font-medium text-foreground">
          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
          {cat.name}
        </span>
      ),
      options:
        cat.children.length === 0
          ? [
              {
                value: `${cat.id}:empty`,
                label: "Sin subcategorías",
                keywords: [cat.name],
                disabled: true,
                className: "italic text-xs",
              },
            ]
          : cat.children.map((sub) => ({
              value: sub.id,
              label: sub.name,
              // Buscar por la principal también encuentra sus subcategorías
              keywords: [cat.name],
              className: "pl-10",
              content: (
                <span className="flex items-center gap-2">
                  <CategoryIcon icon={sub.icon ?? cat.icon} color={cat.color} size="sm" />
                  {sub.name}
                </span>
              ),
            })),
    })),
  ];

  return (
    <Combobox
      groups={groups}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder="Sin categoría"
      searchPlaceholder="Buscar categoría…"
      emptyText="Ninguna categoría coincide"
      selected={
        selected && (
          <span className="flex min-w-0 items-center gap-2">
            <CategoryIcon icon={selected.icon} color={selected.color} size="sm" />
            <span className="truncate">{selected.label}</span>
          </span>
        )
      }
    />
  );
}

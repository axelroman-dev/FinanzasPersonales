"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategoryOption = {
  id: string;
  name: string;
  color: string | null;
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
  children: { id: string; name: string; color: string | null }[];
};

/**
 * Selector de categoría: cada categoría principal es un bloque separado que
 * se puede elegir, con sus subcategorías debajo marcadas por una guía. El
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
  /** id de la categoría, o "" para ninguna */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const options = categories.filter((c) => c.kind === kind);

  // Texto del valor elegido: la subcategoría sola no dice de qué principal es
  let selectedLabel: string | undefined;
  for (const cat of options) {
    if (cat.id === value) selectedLabel = cat.name;
    const sub = cat.children.find((c) => c.id === value);
    if (sub) selectedLabel = `${cat.name} › ${sub.name}`;
  }

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Sin categoría">{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin categoría</SelectItem>
        {options.map((cat) => (
          <SelectGroup key={cat.id} className="mt-1 border-t pt-1">
            <SelectItem value={cat.id} className="font-medium">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cat.color ?? "#71717a" }}
                />
                {cat.name}
              </span>
            </SelectItem>
            {cat.children.map((sub) => (
              <SelectItem
                key={sub.id}
                value={sub.id}
                // Guía vertical bajo el punto de la categoría principal
                className="pl-12 text-muted-foreground before:absolute before:inset-y-0 before:left-[2.3rem] before:border-l before:border-border focus:text-accent-foreground data-[state=checked]:text-foreground"
              >
                {sub.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

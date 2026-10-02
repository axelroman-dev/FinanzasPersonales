"use client";

import {
  Select,
  SelectContent,
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
 * Selector de categoría: cada categoría principal se puede elegir, y sus
 * subcategorías aparecen debajo con sangría. Solo muestra las del tipo dado.
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

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Sin categoría" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin categoría</SelectItem>
        {options.map((cat) => (
          <div key={cat.id}>
            <SelectItem value={cat.id}>
              <span className="flex items-center gap-2 font-medium">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.color ?? "#71717a" }}
                />
                {cat.name}
              </span>
            </SelectItem>
            {cat.children.map((sub) => (
              <SelectItem key={sub.id} value={sub.id} className="pl-8">
                <span className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: sub.color ?? cat.color ?? "#71717a" }}
                  />
                  {sub.name}
                </span>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

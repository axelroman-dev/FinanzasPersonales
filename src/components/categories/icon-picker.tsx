"use client";

import { useState } from "react";
import { CATEGORY_ICON_GROUPS, CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

/**
 * Selector de icono de Tabler agrupado por tema: una pestaña por grupo y la
 * cuadrícula de sus iconos. Abre en el grupo del icono elegido.
 */
export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string | null;
  onChange: (icon: string) => void;
  color: string;
}) {
  const initialGroup = Math.max(
    0,
    CATEGORY_ICON_GROUPS.findIndex((g) => value && g.icons.includes(value))
  );
  const [groupIndex, setGroupIndex] = useState(initialGroup);
  const group = CATEGORY_ICON_GROUPS[groupIndex];

  return (
    <div className="rounded-md border">
      <div className="flex gap-1 overflow-x-auto border-b p-1.5" role="tablist">
        {CATEGORY_ICON_GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            role="tab"
            aria-selected={i === groupIndex}
            onClick={() => setGroupIndex(i)}
            className={cn(
              "shrink-0 rounded px-2 py-1 text-xs transition-colors",
              i === groupIndex
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1 p-2 sm:grid-cols-8" role="tabpanel">
        {group.icons.map((name) => {
          const Icon = CATEGORY_ICONS[name];
          const selected = name === value;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-label={name}
              aria-pressed={selected}
              title={name}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border transition-colors",
                selected
                  ? "border-current"
                  : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              style={selected ? { color, backgroundColor: `${color}26` } : undefined}
            >
              <Icon className="h-5 w-5" stroke={1.75} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

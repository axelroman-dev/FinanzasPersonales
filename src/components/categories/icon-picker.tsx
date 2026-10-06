"use client";

import { useEffect, useRef } from "react";
import { CATEGORY_ICON_GROUPS, CATEGORY_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

/**
 * Selector de icono de Tabler: un cuadro con scroll con todos los iconos,
 * agrupados por tema bajo un título. Al abrir se desplaza al icono elegido.
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
  const boxRef = useRef<HTMLDivElement>(null);

  // Solo al montar: mover el scroll del cuadro (no el del modal) al elegido
  useEffect(() => {
    const box = boxRef.current;
    const selected = box?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (box && selected) {
      box.scrollTop = selected.offsetTop - box.clientHeight / 2;
    }
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative max-h-60 min-w-0 overflow-y-auto overscroll-contain rounded-md border [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
    >
      {CATEGORY_ICON_GROUPS.map((group) => (
        <div key={group.label} role="group" aria-label={group.label}>
          {/* Título fijo arriba mientras se recorre su grupo */}
          <p className="sticky top-0 z-10 border-b bg-background/95 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1 p-2">
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
                    "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
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
      ))}
    </div>
  );
}

"use client";

import * as React from "react";
import { History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { suggestDescriptions } from "@/lib/description-suggestions";
import { cn } from "@/lib/utils";

/**
 * Campo de descripción con sugerencias de las que ya se usaron: al escribir
 * aparecen las que coinciden (sin importar acentos) y se eligen con el mouse
 * o con flechas y Enter. Si no se elige ninguna, se guarda lo escrito.
 */
export function DescriptionInput({
  value,
  onChange,
  known,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  /** Descripciones ya usadas, de la más usada a la menos */
  known: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const suggestions = React.useMemo(() => suggestDescriptions(known, value), [known, value]);
  const show = open && suggestions.length > 0;

  function choose(text: string) {
    onChange(text);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!show) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 = ninguna marcada (Enter guarda lo escrito)
      setActive((i) => {
        const next = i + step;
        if (next < -1) return suggestions.length - 1;
        if (next >= suggestions.length) return -1;
        return next;
      });
    } else if (e.key === "Enter" && active >= 0 && active < suggestions.length) {
      // Elegir la sugerencia, no enviar el formulario
      e.preventDefault();
      choose(suggestions[active]);
    }
  }

  return (
    <Popover open={show} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...props}
          ref={inputRef}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </PopoverAnchor>
      <PopoverContent
        className="z-[60] w-[var(--radix-popover-trigger-width)] p-1"
        // El foco se queda en el campo para seguir escribiendo
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (e.target === inputRef.current) e.preventDefault();
        }}
      >
        <ul id={listId} role="listbox" aria-label="Descripciones usadas">
          {suggestions.map((text, i) => (
            <li
              key={text}
              role="option"
              aria-selected={i === active}
              // mousedown: elegir antes de que el campo pierda el foco
              onMouseDown={(e) => {
                e.preventDefault();
                choose(text);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground"
              )}
            >
              <History className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="truncate">{text}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

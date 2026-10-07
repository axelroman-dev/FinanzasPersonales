"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  /** Texto por el que se busca (y que se muestra si no hay `content`) */
  label: string;
  /** Más texto para buscar, p. ej. el nombre de la categoría principal */
  keywords?: string[];
  content?: React.ReactNode;
  /** Contenido a la derecha, p. ej. el saldo */
  aside?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export type ComboboxGroup = {
  key: string;
  heading?: React.ReactNode;
  options: ComboboxOption[];
  className?: string;
};

/** Sin mayúsculas ni acentos: "nomina" encuentra "Nómina" */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Cada palabra buscada debe aparecer en la etiqueta o en sus palabras clave */
function filter(_value: string, search: string, keywords?: string[]): number {
  const haystack = normalize((keywords ?? []).join(" "));
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return words.every((w) => haystack.includes(w)) ? 1 : 0;
}

/**
 * Selector con búsqueda: se abre como un select, pero se puede escribir para
 * filtrar las opciones (sin importar acentos) y elegir con flechas y Enter.
 * Si se escribe con el selector enfocado, se abre ya buscando ese texto.
 */
export function Combobox({
  groups,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  selected,
  disabled,
}: {
  groups: ComboboxGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Cómo mostrar el valor elegido en el botón; por defecto su etiqueta */
  selected?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = groups.flatMap((g) => g.options).find((o) => o.value === value);
  const display = selected ?? selectedOption?.label;

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Cada vez que se abre, la búsqueda empieza vacía
    if (!next) setSearch("");
  }

  function choose(next: string) {
    onChange(next);
    onOpenChange(false);
  }

  // Escribir sobre el botón cerrado abre la búsqueda con esa letra
  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (open || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 && e.key !== " ") {
      e.preventDefault();
      setSearch(e.key);
      setOpen(true);
    }
  }

  return (
    // modal: sin él, el modal de fondo bloquea el scroll de la lista
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          onKeyDown={onTriggerKeyDown}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn("min-w-0 flex-1 truncate", !display && "text-muted-foreground")}>
            {display ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        // Encima de los modales, que también usan z-50
        className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0"
        // Directo a la búsqueda para escribir en cuanto se abre
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Command filter={filter} loop>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto overscroll-contain p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group
                key={group.key}
                heading={group.heading}
                className={cn(
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground",
                  group.className
                )}
              >
                {group.options.map((opt) => (
                  <Command.Item
                    key={opt.value || "__none__"}
                    value={opt.value || "__none__"}
                    keywords={[opt.label, ...(opt.keywords ?? [])]}
                    disabled={opt.disabled}
                    onSelect={() => choose(opt.value)}
                    className={cn(
                      "relative flex cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                      opt.className
                    )}
                  >
                    {opt.value === value && !opt.disabled && (
                      <Check className="absolute left-2 h-4 w-4" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{opt.content ?? opt.label}</span>
                    {opt.aside && <span className="ml-auto shrink-0 pl-4">{opt.aside}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

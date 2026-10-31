"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" ↔ Date en hora local (no UTC) */
function parseDay(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function formatDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const dayLabel = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const triggerClass =
  "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Selector de fecha con calendario. El valor es "YYYY-MM-DD" (o "" sin fecha),
 * como el de un <input type="date">.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Elegir fecha",
  clearable = false,
  className,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Muestra una × para quitar la fecha */
  clearable?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDay(value);

  return (
    // Sin modal: dentro de un Dialog el calendario se monta en él (ver
    // DialogContent) y se puede usar sin apilar otra capa modal encima
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button id={id} type="button" className={triggerClass}>
            <CalendarDays className="h-4 w-4 shrink-0 opacity-50" />
            <span
              className={cn(
                "flex-1 truncate",
                !selected && "text-muted-foreground",
              )}
            >
              {selected ? dayLabel.format(selected) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        {clearable && selected && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Quitar fecha"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="z-[60] w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(formatDay(d));
            setOpen(false);
          }}
          autoFocus
        />
        <div className="flex justify-between border-t px-3 py-2">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              onChange(formatDay(new Date()));
              setOpen(false);
            }}
          >
            Hoy
          </button>
          {clearable && selected && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Quitar
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const dateTimeLabel = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "YYYY-MM-DDTHH:mm" → fecha y hora en hora local (o ahora si no es válido) */
function parseDateTime(value: string): Date {
  const day = parseDay(value) ?? new Date();
  const [, hh = "00", mm = "00"] = /T(\d{2}):(\d{2})/.exec(value) ?? [];
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(hh),
    Number(mm),
  );
}
function formatDateTime(d: Date): string {
  return `${formatDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/**
 * Selector de fecha y hora: calendario y, al lado, columnas de horas (24 h) y
 * minutos. Los cambios quedan en borrador hasta «Aceptar»; cerrar o
 * «Cancelar» los descarta. El valor es "YYYY-MM-DDTHH:mm" en hora local, como
 * el de un <input type="datetime-local">.
 */
export function DateTimePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = parseDateTime(value);
  const [draft, setDraft] = React.useState(current);

  const set = (patch: { day?: Date; hours?: number; minutes?: number }) => {
    const d = patch.day ?? draft;
    setDraft(
      new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        patch.hours ?? draft.getHours(),
        patch.minutes ?? draft.getMinutes(),
      ),
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(current);
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button id={id} type="button" className={triggerClass}>
          <CalendarDays className="h-4 w-4 shrink-0 opacity-50" />
          <span className="flex-1 truncate tabular-nums">
            {dateTimeLabel.format(current)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[60] w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            required
            selected={draft}
            defaultMonth={draft}
            onSelect={(d) => d && set({ day: d })}
            autoFocus
          />
          {/* Las columnas toman la altura del calendario (en móvil, una fija) */}
          <div className="relative h-44 border-t sm:h-auto sm:w-32 sm:border-l sm:border-t-0">
            <div className="absolute inset-0 flex">
              <TimeColumn
                label="Hora"
                options={HOURS}
                value={draft.getHours()}
                onChange={(hours) => set({ hours })}
              />
              <TimeColumn
                label="Minutos"
                options={MINUTES}
                value={draft.getMinutes()}
                onChange={(minutes) => set({ minutes })}
                className="border-l"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setDraft(new Date())}
          >
            Ahora
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                onChange(formatDateTime(draft));
                setOpen(false);
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Copias de las opciones: el scroll se mantiene en la del medio */
const COPIES = 3;

/**
 * Columna de horas o minutos que da la vuelta: después del 59 sigue el 00 y
 * antes del 00, el 59. Se pintan tres copias y, al salir de la del medio, el
 * scroll salta una copia hacia atrás o adelante (no se nota: son iguales). La
 * opción elegida sube al inicio.
 */
function TimeColumn({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const mounted = React.useRef(false);
  // Mientras se anima hasta la opción elegida no se salta de copia: el salto
  // cortaría la animación
  const animating = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Alto de una copia y scroll que deja arriba cada opción de la primera */
  const measure = React.useCallback(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[data-option]");
    if (!items || items.length < options.length * COPIES) return null;
    const first = items[0].offsetTop;
    return {
      copy: items[options.length].offsetTop - first,
      // 4 px de aire sobre la opción elegida
      offset: (i: number) => items[i].offsetTop - first - 4,
    };
  }, [options.length]);

  const recenter = React.useCallback(() => {
    const list = listRef.current;
    const m = measure();
    if (!list || !m || animating.current) return;
    if (list.scrollTop < m.copy / 2) list.scrollTop += m.copy;
    else if (list.scrollTop >= m.copy * 2) list.scrollTop -= m.copy;
  }, [measure]);

  React.useEffect(() => {
    const list = listRef.current;
    const m = measure();
    const index = options.indexOf(value);
    if (!list || !m || index < 0) return;

    if (!mounted.current) {
      mounted.current = true;
      list.scrollTop = m.copy + m.offset(index);
      return;
    }

    // La copia de la opción más cercana a lo que se ve, para no recorrer
    // toda la lista (p. ej. del 59 al 00 que está justo abajo)
    const candidates = Array.from({ length: COPIES }, (_, k) => k * m.copy + m.offset(index));
    let target = candidates.reduce((a, b) =>
      Math.abs(b - list.scrollTop) < Math.abs(a - list.scrollTop) ? b : a,
    );
    // Pasarla a la copia del medio moviendo también el scroll actual
    const shift = target >= m.copy * 2 ? -m.copy : target < m.copy ? m.copy : 0;
    target += shift;

    if (animating.current) clearTimeout(animating.current);
    animating.current = setTimeout(() => {
      animating.current = null;
      recenter();
    }, 500);
    if (shift) list.scrollTop += shift;
    // scrollTo del contenedor y no scrollIntoView: este movería también el modal
    list.scrollTo({ top: target, behavior: "smooth" });
  }, [value, options, measure, recenter]);

  React.useEffect(
    () => () => {
      if (animating.current) clearTimeout(animating.current);
    },
    [],
  );

  return (
    <div
      ref={listRef}
      role="group"
      aria-label={label}
      onScroll={recenter}
      className={cn(
        "relative flex-1 overflow-y-auto overscroll-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {Array.from({ length: COPIES }, (_, copy) =>
        options.map((n) => {
          // Solo la copia del medio es accesible; las otras son de relleno
          const main = copy === 1;
          return (
            <button
              key={`${copy}-${n}`}
              type="button"
              data-option
              aria-hidden={main ? undefined : true}
              tabIndex={main ? undefined : -1}
              aria-pressed={main ? n === value : undefined}
              aria-label={main ? `${label} ${pad(n)}` : undefined}
              onClick={() => onChange(n)}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                n === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              {pad(n)}
            </button>
          );
        }),
      )}
    </div>
  );
}

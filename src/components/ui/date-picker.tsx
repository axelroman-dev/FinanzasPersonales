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
    // modal: dentro de un modal, sin él no se puede usar el calendario
    <Popover open={open} onOpenChange={setOpen} modal>
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

/**
 * Selector de fecha y hora: calendario y la hora en 24 h. El valor es
 * "YYYY-MM-DDTHH:mm" en hora local, como el de un <input type="datetime-local">.
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
  const day = parseDay(value) ?? new Date();
  const [, hh = "00", mm = "00"] = /T(\d{2}):(\d{2})/.exec(value) ?? [];
  const current = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(hh),
    Number(mm),
  );

  const emit = (d: Date, hours: number, minutes: number) =>
    onChange(`${formatDay(d)}T${pad(hours)}:${pad(minutes)}`);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button id={id} type="button" className={triggerClass}>
          <CalendarDays className="h-4 w-4 shrink-0 opacity-50" />
          <span className="flex-1 truncate tabular-nums">
            {dateTimeLabel.format(current)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[60] w-auto p-0">
        <Calendar
          mode="single"
          required
          selected={current}
          defaultMonth={current}
          onSelect={(d) => d && emit(d, Number(hh), Number(mm))}
          autoFocus
        />
        <div className="flex items-center justify-center gap-2 border-t px-3 py-3">
          <span className="mr-1 text-sm text-muted-foreground">Hora</span>
          <TimePart
            value={Number(hh)}
            max={23}
            label="Hora"
            onChange={(h) => emit(current, h, Number(mm))}
          />
          <span className="text-lg font-medium">:</span>
          <TimePart
            value={Number(mm)}
            max={59}
            label="Minutos"
            onChange={(m) => emit(current, Number(hh), m)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              const now = new Date();
              emit(now, now.getHours(), now.getMinutes());
            }}
          >
            Ahora
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(false)}
          >
            Listo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Horas o minutos: se escriben (2 dígitos) o se cambian con las flechas.
 * Los dígitos se toman del evento y no del texto del campo: el campo siempre
 * está lleno ("00") y al hacer clic el cursor quita la selección, así que con
 * maxLength el navegador no dejaba escribir nada.
 */
function TimePart({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(0, n));

  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? pad(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const native = e.nativeEvent as InputEvent;
        if (native.inputType?.startsWith("delete")) {
          setDraft("");
          return;
        }
        const typed = (native.data ?? e.target.value).replace(/\D/g, "");
        if (!typed) return;
        // Tras completar 2 dígitos (o al empezar) se escribe desde cero
        const base = draft && draft.length < 2 ? draft : "";
        const next = (base + typed).slice(0, 2);
        setDraft(next);
        // Completo con 2 dígitos, o con 1 si ya no cabe otro (p. ej. "3" en horas)
        if (next.length === 2 || Number(next) * 10 > max) {
          onChange(clamp(Number(next)));
          setDraft(pad(clamp(Number(next))));
        }
      }}
      onBlur={() => {
        if (draft) onChange(clamp(Number(draft)));
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const step = e.key === "ArrowUp" ? 1 : -1;
          onChange((value + step + max + 1) % (max + 1));
          setDraft(null);
        }
      }}
      className="h-11 w-14 rounded-md border border-input bg-background text-center text-lg font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

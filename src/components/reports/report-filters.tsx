"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Este mes", months: 1 },
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
] as const;

export function ReportFilters({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  // Estado controlado local que se sincroniza con la URL
  const [from, setFrom] = useState<string>(params.get("from") ?? defaultFrom);
  const [to, setTo] = useState<string>(params.get("to") ?? defaultTo);

  // Determinar qué preset está activo (comparando rango con el que genera cada preset)
  const activeMonths = getActivePreset(from, to, defaultFrom, defaultTo);

  // Re-sincronizar cuando cambia la URL
  useEffect(() => {
    const urlFrom = params.get("from");
    const urlTo = params.get("to");
    if (urlFrom !== null && urlFrom !== from) setFrom(urlFrom);
    if (urlTo !== null && urlTo !== to) setTo(urlTo);
    if (urlFrom === null && from !== defaultFrom) setFrom(defaultFrom);
    if (urlTo === null && to !== defaultTo) setTo(defaultTo);
  }, [params, defaultFrom, defaultTo, from, to]);

  function pushRange(newFrom: string, newTo: string) {
    const next = new URLSearchParams();
    if (newFrom && newFrom !== defaultFrom) next.set("from", newFrom);
    if (newTo && newTo !== defaultTo) next.set("to", newTo);
    startTransition(() => {
      router.push(`/reports?${next.toString()}`);
    });
  }

  function onFromChange(value: string) {
    setFrom(value);
    pushRange(value, to);
  }

  function onToChange(value: string) {
    setTo(value);
    pushRange(from, value);
  }

  function setRange(months: number) {
    const now = new Date();
    // Para "X meses" mostramos los últimos X meses completos:
    // to = último día del mes actual; from = día 1 del mes (X-1) atrás
    const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const fromStr = formatLocalDate(fromDate);
    const toStr = formatLocalDate(toDate);
    setFrom(fromStr);
    setTo(toStr);
    pushRange(fromStr, toStr);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      {/* Móvil: fechas en dos columnas con la etiqueta arriba */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
        <label className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="hidden h-4 w-4 lg:block" />
            Desde
          </span>
          <Input
            type="date"
            className="lg:w-auto"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-2">
          <span className="text-sm text-muted-foreground">Hasta</span>
          <Input
            type="date"
            className="lg:w-auto"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </label>
      </div>
      <div className="grid grid-cols-4 gap-1 lg:ml-auto lg:flex">
        {PRESETS.map((preset) => {
          const isActive = activeMonths === preset.months;
          return (
            <Button
              key={preset.months}
              size="sm"
              onClick={() => setRange(preset.months)}
              className={cn(
                // Por defecto lucen neutros (sin relleno)
                "bg-transparent px-2 text-muted-foreground border border-border lg:px-3",
                // En hover se muestran destacados (feedback visual)
                "hover:bg-secondary hover:text-foreground hover:border-border",
                // El seleccionado se ve siempre destacado (aunque sin hover)
                isActive &&
                  "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
              )}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Devuelve el número de meses del preset que coincide con el rango actual,
 * o null si no coincide con ninguno (rango personalizado).
 */
function getActivePreset(
  from: string,
  to: string,
  defaultFrom: string,
  defaultTo: string
): number | null {
  // Si está en defaults (sin params en URL), es el mes actual
  if (from === defaultFrom && to === defaultTo) return 1;

  // Comparar contra cada preset
  const now = new Date();
  for (const { months } of PRESETS) {
    const expectedTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const expectedFrom = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1
    );
    if (
      from === formatLocalDate(expectedFrom) &&
      to === formatLocalDate(expectedTo)
    ) {
      return months;
    }
  }
  return null;
}

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
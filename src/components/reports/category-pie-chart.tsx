"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

type Slice = { id: string; name: string; color: string | null; total: number };

/** Más rebanadas ya no se distinguen: el resto se junta en «Otras» */
const MAX_SLICES = 6;
const FALLBACK_COLOR = "#71717a";

/**
 * Gráfica de dona con la parte de cada categoría en el total. Cada rebanada
 * usa el color de su categoría; el desglose completo va debajo, en la lista.
 */
export function CategoryPieChart({ items, total }: { items: Slice[]; total: number }) {
  const slices =
    items.length <= MAX_SLICES
      ? items
      : [
          ...items.slice(0, MAX_SLICES - 1),
          {
            id: "__others__",
            name: "Otras",
            color: FALLBACK_COLOR,
            total: items.slice(MAX_SLICES - 1).reduce((s, i) => s + i.total, 0),
          },
        ];

  const grouped = items.length > MAX_SLICES ? items.slice(MAX_SLICES - 1) : [];

  return (
    <div className="space-y-2">
      <div className="relative mx-auto h-56 w-full max-w-xs">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              // Separación de 2px entre rebanadas, del color de la tarjeta
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color ?? FALLBACK_COLOR} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as Slice;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <p className="flex items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color ?? FALLBACK_COLOR }}
                      />
                      {s.name}
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                      {formatCurrency(s.total)} · {((s.total / total) * 100).toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total en el centro de la dona */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
      {grouped.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Otras: {formatList(grouped.map((g) => g.name))}
        </p>
      )}
    </div>
  );
}

const listFormat = new Intl.ListFormat("es", { type: "conjunction" });
function formatList(names: string[]): string {
  return listFormat.format(names);
}

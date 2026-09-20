"use client";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FolderTree } from "lucide-react";
import { CategoryDialog } from "./category-dialog";
import { useEffect, useState } from "react";

type CatNode = {
  id: string;
  name: string;
  color: string | null;
  kind: "INCOME" | "EXPENSE" | "BOTH";
  usageCount: number;
  children: CatNode[];
};

type TotalsByCategory = Record<string, number>;

export function CategorySidebar({
  categories,
  selectedId,
  monthlyTotals,
}: {
  categories: CatNode[];
  selectedId: string | null;
  /** Total del mes por categoría raíz (solo el subcategory hijo) */
  monthlyTotals: TotalsByCategory;
}) {
  // Distribución de categorías por grupo:
  // - EXPENSE → solo en Gastos
  // - INCOME → solo en Ingresos
  // - BOTH → en ambos grupos (es una categoría compartida)
  // Pero para evitar la confusión visual de "Otros" apareciendo duplicado,
  // lo mostramos en Gastos. Si tiene subcategorías, también en Ingresos.
  // En la práctica, "BOTH" significa "puede aplicar a ambos tipos", no "se duplica".

  // Para evitar duplicados visuales: cada BOTH aparece UNA SOLA VEZ en Gastos.
  // Si el usuario quiere usarla para ingresos, lo puede hacer desde el grupo Gastos
  // o cambiar el `kind` a INCOME si es exclusivamente para ingresos.

  // Mostrar BOTH en gastos únicamente (no duplicar).
  const expenses = categories.filter(
    (c) => c.kind === "EXPENSE" || c.kind === "BOTH"
  );
  // Para ingresos, excluir las BOTH (ya aparecen en gastos)
  const incomes = categories.filter((c) => c.kind === "INCOME");

  return (
    <div className="space-y-6">
      <SidebarGroup
        title="Gastos"
        badgeVariant="destructive"
        categories={expenses}
        selectedId={selectedId}
        monthlyTotals={monthlyTotals}
        showBothHint
      />
      <SidebarGroup
        title="Ingresos"
        badgeVariant="success"
        categories={incomes}
        selectedId={selectedId}
        monthlyTotals={monthlyTotals}
      />
    </div>
  );
}

function SidebarGroup({
  title,
  badgeVariant,
  categories,
  selectedId,
  monthlyTotals,
  showBothHint,
}: {
  title: string;
  badgeVariant: "destructive" | "success";
  categories: CatNode[];
  selectedId: string | null;
  monthlyTotals: TotalsByCategory;
  showBothHint?: boolean;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Badge variant={badgeVariant} className="text-xs">
          {title}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {categories.length}
        </span>
      </div>
      {showBothHint && (
        <p className="text-[11px] text-muted-foreground/70 px-1">
          Las categorías marcadas con ↕ también aceptan ingresos.
        </p>
      )}
      <div className="space-y-1">
        {categories.map((cat) => {
          const isSelected = cat.id === selectedId;
          const total = monthlyTotals[cat.id] ?? 0;
          const isBoth = cat.kind === "BOTH";
          return (
            <Link
              key={cat.id}
              href={`/categories?selected=${cat.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors group",
                isSelected
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: cat.color ?? "#71717a" }}
              />
              <span className="font-medium flex-1 truncate">{cat.name}</span>
              {isBoth && showBothHint && (
                <span
                  className="text-[10px] uppercase tracking-wide text-muted-foreground/70"
                  title="Aplica a gastos e ingresos"
                >
                  ↕
                </span>
              )}
              {total > 0 && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    badgeVariant === "destructive"
                      ? "text-red-400"
                      : "text-emerald-400"
                  )}
                >
                  {formatCurrency(total)}
                </span>
              )}
              {cat.children.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {cat.children.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
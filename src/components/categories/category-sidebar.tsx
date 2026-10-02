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
  kind: "INCOME" | "EXPENSE" | "INTERNAL";
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
  const expenses = categories.filter((c) => c.kind === "EXPENSE");
  const incomes = categories.filter((c) => c.kind === "INCOME");

  return (
    <div className="space-y-6">
      <SidebarGroup
        title="Gastos"
        badgeVariant="destructive"
        categories={expenses}
        selectedId={selectedId}
        monthlyTotals={monthlyTotals}
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
}: {
  title: string;
  badgeVariant: "destructive" | "success";
  categories: CatNode[];
  selectedId: string | null;
  monthlyTotals: TotalsByCategory;
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
      <div className="space-y-1">
        {categories.map((cat) => {
          const isSelected = cat.id === selectedId;
          const total = monthlyTotals[cat.id] ?? 0;
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
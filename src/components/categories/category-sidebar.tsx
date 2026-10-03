"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <>
      {/* Móvil y tablet: selector compacto; la lista completa empujaba el detalle
          hacia abajo o, junto a la barra lateral, lo dejaba sin espacio */}
      <MobilePicker
        expenses={expenses}
        incomes={incomes}
        selectedId={selectedId}
      />
      <div className="hidden space-y-6 xl:block">
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
    </>
  );
}

function MobilePicker({
  expenses,
  incomes,
  selectedId,
}: {
  expenses: CatNode[];
  incomes: CatNode[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const groups = [
    { label: "Gastos", items: expenses },
    { label: "Ingresos", items: incomes },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="xl:hidden">
      <Select
        value={selectedId ?? undefined}
        onValueChange={(id) => router.push(`/categories?selected=${id}`)}
      >
        <SelectTrigger aria-label="Categoría">
          <SelectValue placeholder="Elige una categoría" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.items.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color ?? "#71717a" }}
                    />
                    {cat.name}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
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
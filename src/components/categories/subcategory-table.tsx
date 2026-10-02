"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_KIND_LABEL, type CategoryKind } from "@/lib/category-kind";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MoreHorizontal,
  Plus,
  Edit,
  Trash2,
  Loader2,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CategoryDialog } from "./category-dialog";

export type Subcategory = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  usageCount: number;
};

export type SubcategoryStat = {
  subcategoryId: string;
  subcategoryName: string;
  color: string | null;
  count: number;
  total: number;
  byType: { INCOME: number; EXPENSE: number };
};

export function SubcategoryTable({
  category,
  subcategories,
  monthlyStats,
}: {
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    kind: CategoryKind;
    /** Movimientos de la categoría y sus subcategorías */
    usageCount: number;
  };
  subcategories: Subcategory[];
  monthlyStats: SubcategoryStat[];
}) {
  // Stats por subcategoría para mostrar el gasto del mes
  const statsById = new Map<string, SubcategoryStat>();
  for (const s of monthlyStats) {
    statsById.set(s.subcategoryId, s);
  }

  const expenseTotal = monthlyStats.reduce(
    (sum, s) => sum + (s.byType.EXPENSE ?? 0),
    0
  );
  const incomeTotal = monthlyStats.reduce(
    (sum, s) => sum + (s.byType.INCOME ?? 0),
    0
  );
  const totalMovements = monthlyStats.reduce((sum, s) => sum + s.count, 0);
  const usedSubs = subcategories.filter((s) => s.usageCount > 0).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-md shrink-0"
              style={{ backgroundColor: (category.color ?? "#71717a") + "30" }}
            >
              <div
                className="h-full w-full rounded-md flex items-center justify-center text-sm font-bold"
                style={{ color: category.color ?? "#71717a" }}
              >
                {category.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="truncate">{category.name}</CardTitle>
                <Badge
                  variant={category.kind === "EXPENSE" ? "destructive" : "success"}
                  className="text-[10px]"
                >
                  {CATEGORY_KIND_LABEL[category.kind]}
                </Badge>
              </div>
              <CardDescription>
                {subcategories.length} subcategoría
                {subcategories.length === 1 ? "" : "s"} · {usedSubs} en uso
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CategoryDialog mode="create" parentId={category.id}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nueva subcategoría
              </Button>
            </CategoryDialog>

            <CategoryMenu
              category={category}
              subcategoryCount={subcategories.length}
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          <Kpi
            label={category.kind === "EXPENSE" ? "Gasto del mes" : "Ingreso del mes"}
            value={formatCurrency(expenseTotal + incomeTotal)}
            color={category.kind === "EXPENSE" ? "text-red-400" : "text-emerald-400"}
          />
          <Kpi
            label="Movimientos del mes"
            value={totalMovements.toString()}
          />
          <Kpi
            label="Subcategorías"
            value={`${subcategories.length}`}
            sublabel={`${usedSubs} con uso`}
          />
        </div>
      </CardHeader>

      <CardContent>
        {subcategories.length === 0 ? (
          <EmptyState categoryName={category.name} categoryId={category.id} />
        ) : (
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5">Subcategoría</th>
                  <th className="px-4 py-2.5 text-right">Movimientos</th>
                  <th className="px-4 py-2.5 text-right">
                    {category.kind === "EXPENSE" ? "Gasto del mes" : "Ingreso del mes"}
                  </th>
                  <th className="px-4 py-2.5 text-right">Uso total</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {subcategories.map((sub) => {
                  const stat = statsById.get(sub.id);
                  return (
                    <SubcategoryRow
                      key={sub.id}
                      sub={sub}
                      stat={stat}
                      category={category}
                    />
                  );
                })}
              </tbody>
              {monthlyStats.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-secondary/30 font-medium">
                    <td className="px-4 py-2.5 text-sm">Total del mes</td>
                    <td className="px-4 py-2.5 text-sm text-right tabular-nums">
                      {totalMovements}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-sm text-right tabular-nums font-semibold",
                        category.kind === "EXPENSE" ? "text-red-400" : "text-emerald-400"
                      )}
                    >
                      {formatCurrency(expenseTotal + incomeTotal)}
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

function EmptyState({
  categoryName,
  categoryId,
}: {
  categoryName: string;
  categoryId: string;
}) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground mb-3">
        {categoryName} aún no tiene subcategorías
      </p>
      <CategoryDialog mode="create" parentId={categoryId}>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          Crear primera subcategoría
        </Button>
      </CategoryDialog>
    </div>
  );
}

function CategoryMenu({
  category,
  subcategoryCount,
}: {
  category: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    kind: CategoryKind;
    usageCount: number;
  };
  subcategoryCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  function onDelete() {
    const details = [
      subcategoryCount > 0 &&
        `Se eliminarán también sus ${subcategoryCount} subcategoría(s).`,
      category.usageCount > 0 &&
        `${category.usageCount} movimiento(s) quedarán SIN categoría.`,
    ].filter(Boolean);
    if (
      !confirm(
        [`¿Eliminar la categoría "${category.name}"?`, ...details].join("\n\n")
      )
    ) {
      return;
    }
    startTransition(async () => {
      // force: el usuario ya confirmó desvincular los movimientos
      const res = await fetch(`/api/categories/${category.id}?force=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al eliminar");
        return;
      }
      router.push("/categories");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={isPending}
            aria-label="Opciones de categoría"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
            Editar categoría
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar categoría
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen && (
        <CategoryDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          category={{
            id: category.id,
            name: category.name,
            kind: category.kind,
            color: category.color,
            icon: category.icon,
            parentId: null,
          }}
        />
      )}
    </>
  );
}

function SubcategoryRow({
  sub,
  stat,
  category,
}: {
  sub: Subcategory;
  stat: SubcategoryStat | undefined;
  category: { id: string; kind: CategoryKind };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isProtected = sub.usageCount > 0;

  async function onDelete() {
    if (isProtected) return;
    const probe = await fetch(`/api/categories/${sub.id}`, { method: "DELETE" });
    if (probe.status === 409) {
      const data = await probe.json();
      const force = confirm(
        `"${sub.name}" tiene ${data.usageCount ?? 0} movimiento(s) vinculado(s).\n\n` +
          `Si la eliminas con "force", esos movimientos quedarán SIN categoría.\n\n` +
          `¿Continuar?`
      );
      if (!force) return;
      startTransition(async () => {
        const res = await fetch(`/api/categories/${sub.id}?force=true`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          alert(errData.error || "Error al eliminar");
          return;
        }
        router.refresh();
      });
      return;
    }
    if (!probe.ok) {
      alert("Error al eliminar");
      return;
    }
    router.refresh();
  }

  const expenseAmount = stat?.byType.EXPENSE ?? 0;
  const incomeAmount = stat?.byType.INCOME ?? 0;
  const singleAmount = expenseAmount + incomeAmount;
  const singleColor = category.kind === "INCOME" ? "text-emerald-400" : "text-red-400";

  return (
    <tr className={cn("border-b last:border-0 hover:bg-secondary/30", hidden && "opacity-50")}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: sub.color ?? "#71717a" }}
          />
          <span className={cn("text-sm font-medium", hidden && "line-through")}>
            {sub.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm text-right tabular-nums text-muted-foreground">
        {stat?.count ?? 0}
      </td>
      <td
        className={cn(
          "px-4 py-2.5 text-sm text-right tabular-nums font-medium",
          singleColor
        )}
      >
        {singleAmount > 0 ? formatCurrency(singleAmount) : (
          <span className="text-muted-foreground">$0.00</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-right tabular-nums text-muted-foreground">
        {sub.usageCount > 0 ? sub.usageCount : <span className="text-xs">—</span>}
      </td>
      <td className="px-4 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-secondary"
              disabled={isPending}
              aria-label={`Opciones de ${sub.name}`}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHidden((v) => !v)}>
              {hidden ? (
                <>
                  <Eye className="h-4 w-4" />
                  Mostrar
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" />
                  Ocultar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              disabled={isProtected}
              className="text-destructive focus:text-destructive data-[disabled]:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isProtected ? `En uso (${sub.usageCount})` : "Eliminar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>

      {editOpen && (
        <CategoryDialog
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          category={{
            id: sub.id,
            name: sub.name,
            kind: category.kind,
            color: sub.color,
            icon: sub.icon,
            parentId: category.id,
          }}
        />
      )}
    </tr>
  );
}
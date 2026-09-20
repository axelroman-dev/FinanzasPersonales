import { requireUser } from "@/lib/auth";
import {
  getCategoryTree,
  getMonthlyTotalsByRoot,
} from "@/lib/categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderTree } from "lucide-react";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategorySidebar } from "@/components/categories/category-sidebar";
import { SubcategoryTable } from "@/components/categories/subcategory-table";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { selected?: string };
}) {
  const user = await requireUser();

  // Una sola query para árbol + totales del mes
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [tree, totals] = await Promise.all([
    getCategoryTree(user.id),
    getMonthlyTotalsByRoot({
      userId: user.id,
      from: startOfMonth,
      to: endOfMonth,
    }),
  ]);

  // monthlyTotals: total por categoría raíz (ya calculado en una sola pasada)
  const monthlyTotals: Record<string, number> = {};
  for (const cat of tree) {
    monthlyTotals[cat.id] = totals.byParent.get(cat.id) ?? 0;
  }

  // Sin categorías → estado vacío
  if (tree.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
            <p className="text-muted-foreground">
              Organiza tus ingresos y gastos para entender mejor tus finanzas
            </p>
          </div>
          <CategoryDialog mode="create" parentId={null}>
            <Button>
              <Plus className="h-4 w-4" />
              Nueva categoría
            </Button>
          </CategoryDialog>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tienes categorías</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea categorías para clasificar tus movimientos
            </p>
            <CategoryDialog mode="create" parentId={null}>
              <Button>
                <Plus className="h-4 w-4" />
                Crear primera categoría
              </Button>
            </CategoryDialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Categoría seleccionada
  const selectedId = searchParams.selected ?? tree[0]?.id ?? null;
  const selected = tree.find((c) => c.id === selectedId) ?? null;

  // Stats de las subcategorías de la seleccionada (filtradas de los totales ya calculados)
  const selectedSubStats = selected
    ? Array.from(totals.bySubcategory.entries())
        .filter(([, v]) => v.parentId === selected.id)
        .map(([id, v]) => ({
          subcategoryId: id,
          subcategoryName: v.name,
          color: v.color,
          count: v.count,
          total: v.total,
          byType: v.byType,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
          <p className="text-muted-foreground">
            Selecciona una categoría para ver y editar sus subcategorías
          </p>
        </div>
        <CategoryDialog mode="create" parentId={null}>
          <Button>
            <Plus className="h-4 w-4" />
            Nueva categoría
          </Button>
        </CategoryDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="md:sticky md:top-6 md:self-start">
          <CategorySidebar
            categories={tree}
            selectedId={selectedId}
            monthlyTotals={monthlyTotals}
          />
        </aside>

        {/* Panel derecho */}
        {selected ? (
          <SubcategoryTable
            category={{
              id: selected.id,
              name: selected.name,
              color: selected.color,
              kind: selected.kind,
            }}
            subcategories={selected.children.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              usageCount: s.usageCount,
            }))}
            monthlyStats={selectedSubStats}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Selecciona una categoría del panel izquierdo para ver sus
                subcategorías
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
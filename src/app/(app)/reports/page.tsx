import { requireUser } from "@/lib/auth";
import { getCategoryTotals, type CategoryTotal } from "@/lib/categories";
import { getUnrecordedTotal } from "@/lib/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeftRight, ChevronRight } from "lucide-react";
import { ReportFilters } from "@/components/reports/report-filters";
import { CategoryPieChart } from "@/components/reports/category-pie-chart";

function formatLocalDate(d: Date): string {
  // Formato YYYY-MM-DD usando componentes locales (no UTC)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = await requireUser();

  // Default: mes actual (como strings YYYY-MM-DD para evitar problemas de timezone)
  const now = new Date();
  const defaultFromStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultToStr = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  // Parsear fechas desde query params o usar defaults
  const fromStr = searchParams.from ?? defaultFromStr;
  const toStr = searchParams.to ?? defaultToStr;

  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59.999");

  const [expenses, incomes, unrecorded] = await Promise.all([
    getCategoryTotals({ userId: user.id, type: "EXPENSE", from, to }),
    getCategoryTotals({ userId: user.id, type: "INCOME", from, to }),
    getUnrecordedTotal(user.id, from, to),
  ]);

  const totalExpense = expenses.reduce((s, e) => s + e.total, 0);
  const totalIncome = incomes.reduce((s, i) => s + i.total, 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          En qué se va y de dónde viene tu dinero
        </p>
      </div>

      <ReportFilters defaultFrom={defaultFromStr} defaultTo={defaultToStr} />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 md:col-span-1 lg:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance del período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                net >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ajustes de cuenta: no entran en los totales, pero muestran lo que faltó registrar */}
      {unrecorded.count > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
            <div>
              <p className="text-sm font-medium">Sin registrar</p>
              <p className="text-xs text-muted-foreground">
                {unrecorded.count === 1
                  ? "1 ajuste de cuenta"
                  : `${unrecorded.count} ajustes de cuenta`}{" "}
                en el período; no se suman a ingresos ni gastos
              </p>
            </div>
            <p className="text-xl font-bold tabular-nums text-amber-400">
              {formatCurrency(unrecorded.net)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryList
          title="Gastos por categoría"
          items={expenses}
          total={totalExpense}
          emptyText="No hay gastos en este período"
          negative
          chart={
            expenses.length > 0 && (
              <CategoryPieChart
                items={expenses.map((e) => ({
                  id: e.categoryId,
                  name: e.categoryName,
                  color: e.color,
                  total: e.total,
                }))}
                total={totalExpense}
              />
            )
          }
        />
        <CategoryList
          title="Ingresos por categoría"
          items={incomes}
          total={totalIncome}
          emptyText="No hay ingresos en este período"
          negative={false}
        />
      </div>
    </div>
  );
}

function CategoryList({
  title,
  items,
  total,
  emptyText,
  negative,
  chart,
}: {
  title: string;
  items: CategoryTotal[];
  total: number;
  emptyText: string;
  negative: boolean;
  /** Gráfica opcional sobre el desglose */
  chart?: React.ReactNode;
}) {
  const amountColor = negative ? "text-red-400" : "text-emerald-400";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chart && <div className="pb-2">{chart}</div>}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{emptyText}</p>
        ) : (
          items.map((item) => {
            const row = (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color ?? "#71717a" }}
                    />
                    <span className="text-sm font-medium truncate">
                      {item.categoryName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({item.count})
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-semibold tabular-nums ${amountColor}`}>
                      {formatCurrency(item.total)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={item.percent}
                  indicatorClassName={negative ? "bg-red-500" : "bg-emerald-500"}
                  // Con gráfica, la barra lleva el color de la categoría para
                  // relacionarla con su rebanada
                  indicatorColor={chart ? item.color ?? undefined : undefined}
                />
              </div>
            );

            // Solo se despliega si hay subcategorías: una sola fila «Sin
            // subcategoría» repetiría el total de la raíz
            const hasBreakdown = item.children.some((c) => !c.isRootOnly);
            if (!hasBreakdown) return <div key={item.categoryId}>{row}</div>;

            return (
              <details key={item.categoryId} className="group">
                <summary className="flex cursor-pointer list-none items-start gap-1 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <div className="min-w-0 flex-1">{row}</div>
                </summary>
                <ul className="mt-2 ml-5 space-y-1.5 border-l pl-3">
                  {item.children.map((child) => (
                    <li
                      key={child.categoryId}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: child.color ?? "#71717a" }}
                        />
                        <span
                          className={`text-sm truncate ${
                            child.isRootOnly
                              ? "italic text-muted-foreground"
                              : ""
                          }`}
                        >
                          {child.categoryName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({child.count})
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm tabular-nums">
                          {formatCurrency(child.total)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {child.percent.toFixed(1)}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

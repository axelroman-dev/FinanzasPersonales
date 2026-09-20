import { requireUser } from "@/lib/auth";
import { getCategoryTotals } from "@/lib/categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeftRight } from "lucide-react";
import { ReportFilters } from "@/components/reports/report-filters";

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

  const [expenses, incomes] = await Promise.all([
    getCategoryTotals({ userId: user.id, type: "EXPENSE", from, to }),
    getCategoryTotals({ userId: user.id, type: "INCOME", from, to }),
  ]);

  const totalExpense = expenses.reduce((s, e) => s + e.total, 0);
  const totalIncome = incomes.reduce((s, i) => s + i.total, 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          En qué se va y de dónde viene tu dinero
        </p>
      </div>

      <ReportFilters defaultFrom={defaultFromStr} defaultTo={defaultToStr} />

      <div className="grid gap-4 md:grid-cols-3">
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
        <Card>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryList
          title="Gastos por categoría"
          items={expenses}
          total={totalExpense}
          emptyText="No hay gastos en este período"
          negative
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
}: {
  title: string;
  items: { categoryId: string; categoryName: string; color: string | null; total: number; count: number; percent: number }[];
  total: number;
  emptyText: string;
  negative: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item.categoryId} className="space-y-1.5">
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
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      negative ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
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
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
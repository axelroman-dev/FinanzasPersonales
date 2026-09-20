import { requireUser } from "@/lib/auth";
import { calculateBalance, getUpcomingCreditEvents, getMonthlyFlow } from "@/lib/balance";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MonthlyFlowChart } from "@/components/dashboard/monthly-flow-chart";

export default async function DashboardPage() {
  const user = await requireUser();
  const [balance, events, flow] = await Promise.all([
    calculateBalance(user.id),
    getUpcomingCreditEvents(user.id),
    getMonthlyFlow(user.id),
  ]);

  const balancePositive = balance.realBalance >= 0;
  const totalIncome = flow.reduce((s, d) => s + d.income, 0);
  const totalExpense = flow.reduce((s, d) => s + d.expense, 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hola, {user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">
          Resumen de tus finanzas
        </p>
      </div>

      {/* Balance real */}
      <Card className="border-2">
        <CardContent className="p-6 md:p-8">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Balance real
            </p>
            <p
              className={`text-5xl md:text-6xl font-bold tracking-tight ${
                balancePositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(balance.realBalance)}
            </p>
            <p className="text-sm text-muted-foreground pt-2">
              Dinero disponible {formatCurrency(balance.cashAvailable)} − Deuda{" "}
              {formatCurrency(balance.creditUsed)} − Suscripciones{" "}
              {formatCurrency(balance.subscriptionsTotal)} − MSI{" "}
              {formatCurrency(balance.msiMonthlyTotal)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dinero disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(balance.cashAvailable)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dédito + ahorro (vales excluidos)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deuda total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(balance.creditUsed)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {balance.creditUsagePercent.toFixed(0)}% de uso global
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compromisos del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">
              {formatCurrency(balance.subscriptionsTotal + balance.msiMonthlyTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Suscripciones + MSI
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Flujo del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Ingresos: {formatCurrency(totalIncome)}</span>
              <span>Gastos: {formatCurrency(totalExpense)}</span>
            </div>
            <MonthlyFlowChart data={flow} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin eventos próximos
              </p>
            )}
            {events.map((ev, i) => (
              <div
                key={`${ev.accountId}-${ev.type}-${i}`}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={ev.type === "cutoff" ? "warning" : "secondary"}>
                    {ev.type === "cutoff" ? "Corte" : "Pago"}
                  </Badge>
                  <span className="text-sm truncate">{ev.accountName}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatShortDate(ev.date)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Subtotales por tipo de cuenta */}
      <Card>
        <CardHeader>
          <CardTitle>Subtotales por tipo de cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Débito</p>
              <p className="text-lg font-semibold">
                {formatCurrency(balance.accountSubtotals.DEBIT)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Crédito (deuda)</p>
              <p className="text-lg font-semibold text-red-400">
                {formatCurrency(balance.accountSubtotals.CREDIT)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ahorro</p>
              <p className="text-lg font-semibold">
                {formatCurrency(balance.accountSubtotals.SAVINGS)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vales</p>
              <p className="text-lg font-semibold text-muted-foreground">
                {formatCurrency(balance.accountSubtotals.VOUCHER)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
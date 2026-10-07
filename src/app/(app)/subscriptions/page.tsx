import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateBalance } from "@/lib/balance";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/utils";
import { firstDueOnOrAfter, isDueInMonth } from "@/lib/subscription-schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Receipt } from "lucide-react";
import { SubscriptionActions } from "@/components/subscriptions/subscription-actions";
import { getCategoryTree } from "@/lib/categories";
import { getPaidSubscriptionIds, summarizeSubscriptions } from "@/lib/subscriptions";
import { chargeDueSubscriptions } from "@/lib/subscription-charges";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  // Registra antes los cobros de suscripciones que ya tocan
  await chargeDueSubscriptions(user.id);
  const [subscriptions, accounts, balance, categories, paidIds] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      include: {
        account: true,
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.account.findMany({ where: { userId: user.id } }),
    calculateBalance(user.id),
    getCategoryTree(user.id, "EXPENSE"),
    getPaidSubscriptionIds(user.id),
  ]);

  const now = new Date();
  const summary = summarizeSubscriptions(
    subscriptions.map((s) => ({ ...s, amount: Number(s.amount) })),
    paidIds,
    now
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Suscripciones</h1>
          <p className="text-muted-foreground">
            Tus cargos recurrentes; se registran solos en su fecha
          </p>
        </div>
        <SubscriptionActions
          mode="create"
          categories={categories}
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            balance: Number(a.balance),
          }))}
        >
          <Button>
            <Plus className="h-4 w-4" />
            Nueva suscripción
          </Button>
        </SubscriptionActions>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between items-baseline">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Total mensual activo
            </p>
            <p className="text-3xl font-bold">{formatCurrency(summary.activeTotal)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Pagado este mes</p>
              <p className="font-semibold text-emerald-400 tabular-nums">
                {formatCurrency(summary.paidTotal)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pendiente este mes</p>
              <p className="font-semibold text-amber-400 tabular-nums">
                {formatCurrency(summary.pendingTotal)}
              </p>
            </div>
          </div>
          <div className="pt-3 border-t space-y-1">
            <div className="flex justify-between items-baseline">
              <p className="text-sm text-muted-foreground">
                Después de pagar las pendientes, tu balance quedaría en:
              </p>
              <p
                className={`text-xl font-bold ${
                  balance.realBalance >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatCurrency(balance.realBalance)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              En su fecha de cobro, cada suscripción activa se registra sola como
              un gasto en su cuenta. Las anuales suman al total mensual 1/12 de su
              monto y solo cuentan como pendientes en su mes.
            </p>
          </div>
        </CardContent>
      </Card>

      {subscriptions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No tienes suscripciones
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agrega tus cargos recurrentes para ver el impacto en tu balance
            </p>
            <SubscriptionActions
              mode="create"
              categories={categories}
              accounts={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                balance: Number(a.balance),
              }))}
            >
              <Button>
                <Plus className="h-4 w-4" />
                Agregar primera
              </Button>
            </SubscriptionActions>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <Card key={sub.id} className={!sub.isActive ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{sub.name}</p>
                  {!sub.isActive ? (
                    <Badge variant="secondary" className="text-xs">
                      Inactiva
                    </Badge>
                  ) : !isDueInMonth(sub, now) ? null : paidIds.has(sub.id) ? (
                    <Badge variant="success" className="text-xs">
                      Cobrada este mes
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">
                      Pendiente
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sub.account.name} • {scheduleLabel(sub)}
                  {sub.isActive && ` • Próximo cobro: ${nextChargeLabel(sub, now)}`}
                  {sub.category &&
                    ` • ${sub.category.parent ? `${sub.category.parent.name} › ` : ""}${sub.category.name}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(Number(sub.amount))}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {sub.frequency === "YEARLY" ? "/año" : "/mes"}
                  </span>
                </p>
                <SubscriptionActions
                  mode="edit"
                  categories={categories}
                  accounts={accounts.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    balance: Number(a.balance),
                  }))}
                  subscription={{
                    id: sub.id,
                    name: sub.name,
                    amount: Number(sub.amount),
                    billingDay: sub.billingDay,
                    frequency: sub.frequency,
                    billingMonth: sub.billingMonth,
                    categoryId: sub.categoryId,
                    isActive: sub.isActive,
                    accountId: sub.accountId,
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Editar ${sub.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </SubscriptionActions>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const monthName = new Intl.DateTimeFormat("es-MX", { month: "long" });

/** "Mensual, día 9" o "Anual, 9 de marzo" */
function scheduleLabel(sub: {
  frequency: "MONTHLY" | "YEARLY";
  billingDay: number;
  billingMonth: number | null;
}): string {
  if (sub.frequency === "MONTHLY") return `Mensual, día ${sub.billingDay}`;
  const month = monthName.format(new Date(2000, (sub.billingMonth ?? 1) - 1, 1));
  return `Anual, ${sub.billingDay} de ${month}`;
}

/** Fecha del próximo cobro; con año si no es este */
function nextChargeLabel(
  sub: {
    frequency: "MONTHLY" | "YEARLY";
    billingDay: number;
    billingMonth: number | null;
    nextChargeAt: Date | null;
  },
  now: Date
): string {
  const next = sub.nextChargeAt ?? firstDueOnOrAfter(sub, now);
  return next.getFullYear() === now.getFullYear() ? formatShortDate(next) : formatDate(next);
}

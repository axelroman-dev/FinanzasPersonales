import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateBalance } from "@/lib/balance";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";
import { SubscriptionActions } from "@/components/subscriptions/subscription-actions";

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const [subscriptions, accounts, balance] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      include: { account: true },
    }),
    prisma.account.findMany({ where: { userId: user.id } }),
    calculateBalance(user.id),
  ]);

  const total = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const projectedBalance = balance.realBalance - total;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suscripciones</h1>
          <p className="text-muted-foreground">
            Tus cargos recurrentes mensuales
          </p>
        </div>
        <SubscriptionActions
          mode="create"
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
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
            <p className="text-3xl font-bold">{formatCurrency(total)}</p>
          </div>
          <div className="pt-3 border-t">
            <div className="flex justify-between items-baseline">
              <p className="text-sm text-muted-foreground">
                Si pagas todas este mes, tu balance quedaría en:
              </p>
              <p
                className={`text-xl font-bold ${
                  projectedBalance >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatCurrency(projectedBalance)}
              </p>
            </div>
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
              accounts={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
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
                  {!sub.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Inactiva
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sub.account.name} • Día {sub.billingDay}
                  {sub.category && ` • ${sub.category}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(Number(sub.amount))}
                </p>
                <SubscriptionActions
                  mode="edit"
                  accounts={accounts.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                  }))}
                  subscription={{
                    id: sub.id,
                    name: sub.name,
                    amount: Number(sub.amount),
                    billingDay: sub.billingDay,
                    category: sub.category,
                    isActive: sub.isActive,
                    accountId: sub.accountId,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
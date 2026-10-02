import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateBalance } from "@/lib/balance";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Receipt } from "lucide-react";
import { SubscriptionActions } from "@/components/subscriptions/subscription-actions";
import { getCategoryTree } from "@/lib/categories";
import { getPaidSubscriptionIds, summarizeSubscriptions } from "@/lib/subscriptions";

export default async function SubscriptionsPage() {
  const user = await requireUser();
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

  const summary = summarizeSubscriptions(
    subscriptions.map((s) => ({ ...s, amount: Number(s.amount) })),
    paidIds
  );

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
          categories={categories}
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
              Una suscripción cuenta como pagada cuando registras el gasto y la
              eliges en el campo &quot;Suscripción&quot; del movimiento.
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
                  ) : paidIds.has(sub.id) ? (
                    <Badge variant="success" className="text-xs">
                      Pagada este mes
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-xs">
                      Pendiente
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sub.account.name} • Día {sub.billingDay}
                  {sub.category &&
                    ` • ${sub.category.parent ? `${sub.category.parent.name} › ` : ""}${sub.category.name}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(Number(sub.amount))}
                </p>
                <SubscriptionActions
                  mode="edit"
                  categories={categories}
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
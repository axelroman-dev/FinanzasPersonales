import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AccountActions } from "@/components/accounts/account-actions";
import { Button } from "@/components/ui/button";
import { Plus, Wallet } from "lucide-react";

const typeLabels: Record<string, string> = {
  DEBIT: "Débito",
  CREDIT: "Crédito",
  SAVINGS: "Ahorro",
  VOUCHER: "Vales de despensa",
};

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  // Agrupar por tipo
  const grouped = accounts.reduce(
    (acc, a) => {
      if (!acc[a.type]) acc[a.type] = [];
      acc[a.type].push(a);
      return acc;
    },
    {} as Record<string, typeof accounts>
  );

  const typeOrder: Array<keyof typeof typeLabels> = ["DEBIT", "CREDIT", "SAVINGS", "VOUCHER"];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuentas</h1>
          <p className="text-muted-foreground">
            Gestiona tus cuentas, tarjetas y vales
          </p>
        </div>
        <AccountActions mode="create">
          <Button>
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </Button>
        </AccountActions>
      </div>

      {accounts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tienes cuentas aún</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Empieza creando tu primera cuenta
            </p>
            <AccountActions mode="create">
              <Button>
                <Plus className="h-4 w-4" />
                Crear primera cuenta
              </Button>
            </AccountActions>
          </CardContent>
        </Card>
      )}

      {typeOrder.map((type) => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        const subtotal = list.reduce((s, a) => s + Number(a.balance), 0);
        const totalCreditLimit = list.reduce(
          (s, a) => s + Number(a.creditLimit ?? 0),
          0
        );

        return (
          <div key={type} className="space-y-3">
            <div className="flex items-baseline justify-between border-b pb-2">
              <h2 className="text-lg font-semibold">{typeLabels[type]}</h2>
              <div className="text-sm">
                <span className="text-muted-foreground">Subtotal: </span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
                {type === "CREDIT" && totalCreditLimit > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatCurrency(totalCreditLimit)} límite
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((acc) => {
                const used = Number(acc.balance);
                const limit = Number(acc.creditLimit ?? 0);
                const available = limit - used;
                const percent = limit > 0 ? (used / limit) * 100 : 0;
                const isHighUsage = percent > 80;

                return (
                  <Card key={acc.id}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.currency}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!acc.includeInBalance && (
                            <Badge variant="outline" className="text-xs">
                              No en balance
                            </Badge>
                          )}
                          <AccountActions
                            mode="edit"
                            account={{
                              id: acc.id,
                              name: acc.name,
                              type: acc.type,
                              balance: Number(acc.balance),
                              currency: acc.currency,
                              includeInBalance: acc.includeInBalance,
                              creditLimit: acc.creditLimit ? Number(acc.creditLimit) : null,
                              cutoffDay: acc.cutoffDay,
                              paymentDay: acc.paymentDay,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <p
                          className={`text-2xl font-bold ${
                            acc.type === "CREDIT" ? "text-red-400" : ""
                          }`}
                        >
                          {formatCurrency(used, acc.currency)}
                        </p>
                        {acc.type === "CREDIT" && limit > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Disponible: {formatCurrency(available, acc.currency)}
                          </p>
                        )}
                      </div>

                      {acc.type === "CREDIT" && limit > 0 && (
                        <div className="space-y-1">
                          <Progress
                            value={percent}
                            indicatorClassName={
                              isHighUsage ? "bg-red-500" : percent > 50 ? "bg-amber-500" : "bg-primary"
                            }
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{percent.toFixed(0)}% usado</span>
                            <span>{formatCurrency(limit)}</span>
                          </div>
                        </div>
                      )}

                      {acc.type === "CREDIT" && (acc.cutoffDay || acc.paymentDay) && (
                        <div className="flex gap-3 pt-2 border-t text-xs">
                          {acc.cutoffDay && (
                            <div>
                              <p className="text-muted-foreground">Corte</p>
                              <p className="font-medium">día {acc.cutoffDay}</p>
                            </div>
                          )}
                          {acc.paymentDay && (
                            <div>
                              <p className="text-muted-foreground">Pago</p>
                              <p className="font-medium">día {acc.paymentDay}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
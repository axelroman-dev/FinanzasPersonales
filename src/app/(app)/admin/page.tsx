import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, ArrowLeftRight, Receipt } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [users, accounts, transactions, subs, activeUsers] = await Promise.all([
    prisma.user.count(),
    prisma.account.count(),
    prisma.transaction.count(),
    prisma.subscription.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const stats = [
    { label: "Usuarios totales", value: users, icon: Users },
    { label: "Usuarios activos", value: activeUsers, icon: Users },
    { label: "Cuentas", value: accounts, icon: Wallet },
    { label: "Transacciones", value: transactions, icon: ArrowLeftRight },
    { label: "Suscripciones", value: subs, icon: Receipt },
  ];

  return (
    <>
      <AdminNav />
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
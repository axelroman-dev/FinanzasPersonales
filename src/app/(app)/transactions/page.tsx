import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeftRight } from "lucide-react";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionActions } from "@/components/transactions/transaction-actions";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    type?: string;
    accountId?: string;
    category?: string;
    msi?: string;
  };
}) {
  const user = await requireUser();
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  // Construir filtros
  const where: any = { userId: user.id };
  if (searchParams.from || searchParams.to) {
    where.date = {};
    if (searchParams.from) where.date.gte = new Date(searchParams.from);
    if (searchParams.to) {
      const to = new Date(searchParams.to);
      to.setHours(23, 59, 59, 999);
      where.date.lte = to;
    }
  }
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.accountId) {
    where.OR = [
      { accountId: searchParams.accountId },
      { transferAccountId: searchParams.accountId },
    ];
  }
  if (searchParams.category) where.category = searchParams.category;
  if (searchParams.msi === "true") where.isMsi = true;
  if (searchParams.msi === "false") where.isMsi = false;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: true,
      transferAccount: true,
      subscription: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground">
            Todos tus gastos, ingresos y transferencias
          </p>
        </div>
        <TransactionActions
          mode="create"
          accounts={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
          }))}
          creditAccounts={accounts
            .filter((a) => a.type === "CREDIT")
            .map((a) => ({ id: a.id, name: a.name, creditLimit: a.creditLimit ? Number(a.creditLimit) : null }))}
          subscriptions={await prisma.subscription.findMany({
            where: { userId: user.id, isActive: true },
            select: { id: true, name: true, amount: true },
          }).then((subs) => subs.map((s) => ({ ...s, amount: Number(s.amount) })))}
        >
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </Button>
        </TransactionActions>
      </div>

      <TransactionFilters accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))} />

      {transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay movimientos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajusta los filtros o crea tu primer movimiento
            </p>
          </CardContent>
        </Card>
      ) : (
        <TransactionsTable
          transactions={transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: Number(t.amount),
            date: t.date.toISOString(),
            description: t.description,
            category: t.category,
            accountName: t.account.name,
            transferAccountName: t.transferAccount?.name ?? null,
            isMsi: t.isMsi,
            msiParentId: t.msiParentId,
            msiInstallments: t.msiInstallments,
            subscriptionName: t.subscription?.name ?? null,
          }))}
        />
      )}
    </div>
  );
}
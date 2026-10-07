import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCategoryTree } from "@/lib/categories";
import { attachmentsEnabled } from "@/lib/storage/crypto";
import { INTERNAL_CATEGORIES } from "@/lib/internal-categories";
import { newTransactionDefaults } from "@/lib/transaction-defaults";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeftRight } from "lucide-react";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import {
  TransactionActions,
  type TransactionFormOptions,
} from "@/components/transactions/transaction-actions";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    type?: string;
    accountId?: string;
    category?: string;
    categoryId?: string;
    msi?: string;
  };
}) {
  const user = await requireUser();
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    getCategoryTree(user.id),
  ]);

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
  if (searchParams.categoryId) {
    // Traer la categoría y todas sus subcategorías para filtrar
    const cat = await prisma.category.findFirst({
      where: { id: searchParams.categoryId, userId: user.id },
      include: { children: true },
    });
    if (cat) {
      const ids = [cat.id, ...cat.children.map((c) => c.id)];
      where.categoryId = { in: ids };
    }
  }
  if (searchParams.msi === "true") where.isMsi = true;
  if (searchParams.msi === "false") where.isMsi = false;

  const [transactions, activeSubs] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: true,
        transferAccount: true,
        subscription: { select: { name: true } },
        categoryRef: { include: { parent: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.subscription.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, name: true, amount: true, categoryId: true },
    }),
  ]);

  const formOptions: TransactionFormOptions = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
    })),
    creditAccounts: accounts
      .filter((a) => a.type === "CREDIT")
      .map((a) => ({
        id: a.id,
        name: a.name,
        creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
      })),
    subscriptions: activeSubs.map((s) => ({ ...s, amount: Number(s.amount) })),
    categories,
    attachmentsEnabled: attachmentsEnabled(),
  };

  // El movimiento nuevo arranca con los filtros activos (cuenta, tipo, categoría)
  const createDefaults = newTransactionDefaults(
    searchParams,
    accounts.map((a) => a.id),
    categories
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="text-muted-foreground">
            Todos tus gastos, ingresos y transferencias
          </p>
        </div>
        <TransactionActions mode="create" {...formOptions} defaults={createDefaults}>
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </Button>
        </TransactionActions>
      </div>

      <TransactionFilters
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
        categories={categories}
      />

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
          transactions={transactions.map((t) => {
            const cat = t.categoryRef;
            const rootCat = cat?.parent ?? cat;
            return {
              id: t.id,
              type: t.type,
              amount: Number(t.amount),
              date: t.date.toISOString(),
              description: t.description,
              category: t.category,
              categoryName: cat ? `${rootCat?.name ?? ""}${cat.parent ? ` › ${cat.name}` : ""}` : null,
              // Las subcategorías usan el color de su principal
              categoryColor: rootCat?.color ?? null,
              categoryIcon: cat ? cat.icon ?? rootCat?.icon ?? null : null,
              isAdjustment: cat?.kind === "INTERNAL",
              isInitialBalance:
                cat?.kind === "INTERNAL" && cat.name === INTERNAL_CATEGORIES.INITIAL_BALANCE,
              accountName: t.account.name,
              transferAccountName: t.transferAccount?.name ?? null,
              isMsi: t.isMsi,
              msiParentId: t.msiParentId,
              msiInstallments: t.msiInstallments,
              subscriptionName: t.subscription?.name ?? null,
              categoryId: t.categoryId,
              accountId: t.accountId,
              transferAccountId: t.transferAccountId,
              subscriptionId: t.subscriptionId,
              attachmentCount: t._count.attachments,
            };
          })}
          formOptions={formOptions}
        />
      )}
    </div>
  );
}
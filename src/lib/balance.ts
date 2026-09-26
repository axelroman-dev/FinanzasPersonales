import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { excludeInternal } from "@/lib/internal-categories";

export type BalanceSummary = {
  // Total dinero en cuentas que cuentan al balance
  cashAvailable: number;
  // Deuda usada en tarjetas de crédito
  creditUsed: number;
  // Total suscripciones activas del mes
  subscriptionsTotal: number;
  // Total mensualidades MSI pendientes
  msiMonthlyTotal: number;
  // Balance real final
  realBalance: number;
  // Porcentaje de uso global de crédito (0-100)
  creditUsagePercent: number;
  // Subtotales por tipo de cuenta
  accountSubtotals: Record<string, number>;
};

export async function calculateBalance(userId: string): Promise<BalanceSummary> {
  // Traer cuentas del usuario
  const accounts = await prisma.account.findMany({
    where: { userId },
  });

  let cashAvailable = 0;
  let creditUsed = 0;
  let totalCreditLimit = 0;
  const accountSubtotals: Record<string, number> = {
    DEBIT: 0,
    CREDIT: 0,
    SAVINGS: 0,
    VOUCHER: 0,
  };

  for (const acc of accounts) {
    const bal = Number(acc.balance);
    const limit = acc.creditLimit ? Number(acc.creditLimit) : 0;

    if (acc.type === "CREDIT") {
      // Para crédito: balance = deuda usada (lo que se debe)
      creditUsed += bal;
      totalCreditLimit += limit;
      accountSubtotals.CREDIT += bal;
    } else {
      accountSubtotals[acc.type] += bal;
      if (acc.includeInBalance) {
        cashAvailable += bal;
      }
    }
  }

  // Suscripciones activas (total del mes)
  const activeSubs = await prisma.subscription.findMany({
    where: { userId, isActive: true },
  });
  const subscriptionsTotal = activeSubs.reduce(
    (sum, s) => sum + Number(s.amount),
    0
  );

  // MSI: mensualidades pendientes del mes actual
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // MSI hijos pendientes: transacciones con msiParentId y isMsi=true y date en el mes
  const msiInstallments = await prisma.transaction.findMany({
    where: {
      userId,
      isMsi: true,
      msiParentId: { not: null },
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });
  const msiMonthlyTotal = msiInstallments.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

  const realBalance =
    cashAvailable - creditUsed - subscriptionsTotal - msiMonthlyTotal;

  const creditUsagePercent =
    totalCreditLimit > 0 ? (creditUsed / totalCreditLimit) * 100 : 0;

  return {
    cashAvailable,
    creditUsed,
    subscriptionsTotal,
    msiMonthlyTotal,
    realBalance,
    creditUsagePercent,
    accountSubtotals,
  };
}

// Próximos pagos/cortes de tarjetas en los próximos 30 días
export async function getUpcomingCreditEvents(userId: string) {
  const credits = await prisma.account.findMany({
    where: { userId, type: "CREDIT" },
  });

  const events: Array<{
    accountId: string;
    accountName: string;
    type: "cutoff" | "payment";
    date: Date;
    daysUntil: number;
  }> = [];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const acc of credits) {
    if (acc.cutoffDay) {
      const cutoffDate = getNextOccurrence(acc.cutoffDay);
      const days = Math.ceil(
        (cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0 && days <= 30) {
        events.push({
          accountId: acc.id,
          accountName: acc.name,
          type: "cutoff",
          date: cutoffDate,
          daysUntil: days,
        });
      }
    }
    if (acc.paymentDay) {
      const payDate = getNextOccurrence(acc.paymentDay);
      const days = Math.ceil(
        (payDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0 && days <= 30) {
        events.push({
          accountId: acc.id,
          accountName: acc.name,
          type: "payment",
          date: payDate,
          daysUntil: days,
        });
      }
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil);
}

function getNextOccurrence(day: number): Date {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Si el día ya pasó este mes, va para el siguiente
  const targetMonth = today >= day ? month + 1 : month;
  // Manejar wrap de año
  const targetDate = new Date(year, targetMonth, day);
  // Si el día no existe en ese mes (ej. 31 en febrero), usar último día
  if (targetDate.getMonth() !== targetMonth) {
    targetDate.setDate(0);
  }
  return targetDate;
}

// Flujo del mes (ingresos vs gastos) por día
export async function getMonthlyFlow(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startOfMonth, lte: endOfMonth },
      // Excluir transferencias (no son ingreso ni gasto real)
      type: { in: ["INCOME", "EXPENSE"] },
      // Ni los ajustes de balance
      ...excludeInternal,
    },
    select: { type: true, amount: true, date: true },
  });

  // Agrupar por día
  const daysInMonth = endOfMonth.getDate();
  const flow: Array<{ day: number; income: number; expense: number }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    flow.push({ day: d, income: 0, expense: 0 });
  }

  for (const tx of txs) {
    const day = tx.date.getDate();
    const idx = day - 1;
    if (tx.type === "INCOME") {
      flow[idx].income += Number(tx.amount);
    } else {
      flow[idx].expense += Number(tx.amount);
    }
  }

  // Acumulado
  let incomeCum = 0;
  let expenseCum = 0;
  const cumulative = flow.map((f) => {
    incomeCum += f.income;
    expenseCum += f.expense;
    return { day: f.day, income: f.income, expense: f.expense, incomeCum, expenseCum };
  });

  return cumulative;
}
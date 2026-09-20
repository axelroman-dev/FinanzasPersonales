import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Genera una compra MSI:
 * - Crea la transacción "padre" con el monto total cargado a la cuenta de crédito
 * - Crea N transacciones hijas (una por mes) con el monto / N como gasto
 */
export async function createMsiPurchase(params: {
  userId: string;
  accountId: string;
  totalAmount: number;
  installments: number;
  description: string;
  category?: string;
  startDate?: Date;
}) {
  const { userId, accountId, totalAmount, installments, description, category } = params;
  const startDate = params.startDate ?? new Date();
  const installmentAmount = new Decimal(totalAmount).div(installments);

  // Validar cuenta de crédito
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, type: "CREDIT" },
  });
  if (!account) throw new Error("Cuenta de crédito no encontrada");

  // Validar límite
  if (account.creditLimit) {
    const newUsed = Number(account.balance) + totalAmount;
    if (newUsed > Number(account.creditLimit)) {
      throw new Error("La compra excede el límite de crédito");
    }
  }

  // 1. Transacción padre (gasto total cargado a la tarjeta)
  const parent = await prisma.transaction.create({
    data: {
      userId,
      type: "EXPENSE",
      amount: new Decimal(totalAmount),
      date: startDate,
      description: `${description} (MSI ${installments}x)`,
      category: category ?? null,
      accountId,
      isMsi: true,
      msiInstallments: installments,
      msiTotalAmount: new Decimal(totalAmount),
    },
  });

  // 2. N transacciones hijas (una por mes) que se cobrarán al balance
  const children: any[] = [];
  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const child = await prisma.transaction.create({
      data: {
        userId,
        type: "EXPENSE",
        amount: installmentAmount,
        date: dueDate,
        description: `${description} - Mensualidad ${i + 1}/${installments}`,
        category: category ?? null,
        accountId,
        isMsi: true,
        msiParentId: parent.id,
        msiInstallments: installments,
        msiTotalAmount: new Decimal(totalAmount),
      },
    });
    children.push(child);
  }

  // 3. Actualizar balance de la cuenta (sumar el total al adeudo)
  await prisma.account.update({
    where: { id: accountId },
    data: { balance: { increment: new Decimal(totalAmount) } },
  });

  return { parent, children };
}
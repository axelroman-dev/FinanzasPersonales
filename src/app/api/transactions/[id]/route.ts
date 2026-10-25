import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { AccountType } from "@prisma/client";
import {
  applyBalanceDeltas,
  editEffects,
  revertEffects,
} from "@/lib/transaction-balance";
import { msiParentRevertAmount } from "@/lib/msi-installments";
import { deleteStoredFiles } from "@/lib/attachments";
import { isCardPayment } from "@/lib/account-types";
import { ensureInternalCategory } from "@/lib/internal-categories";
import { resolveTransactionAmount } from "@/lib/exchange-rates";

const updateSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  amount: z.number().positive().optional(),
  date: z
    .string()
    .transform((s) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return new Date(s + "T00:00:00");
      }
      return new Date(s);
    })
    .optional(),
  description: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string().optional(),
  transferAccountId: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  // Moneda del monto; si no es la de la cuenta se convierte
  currency: z.string().length(3).optional(),
  // Lo que se cobró en la moneda de la cuenta, si no coincide con la tasa
  accountAmount: z.number().positive().optional(),
});

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      include: { account: true, transferAccount: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Si es MSI padre o hijo, no permitir editar (es complejo revertir las mensualidades)
    if (existing.isMsi) {
      return NextResponse.json(
        { error: "Las transacciones MSI no se pueden editar. Elimínalas y crea nuevas." },
        { status: 400 }
      );
    }

    // En un pago de tarjeta solo se cambian el monto y la fecha: cuentas,
    // descripción y categoría las fija el sistema
    const wasCardPayment =
      existing.type === "TRANSFER" &&
      isCardPayment(existing.account.type, existing.transferAccount?.type);
    const data: typeof parsed.data = wasCardPayment
      ? { amount: parsed.data.amount, date: parsed.data.date }
      : parsed.data;
    const { currency: inputCurrency, accountAmount, ...fields } = data;
    const type = data.type ?? existing.type;
    const accountId = data.accountId ?? existing.accountId;
    const transferAccountId =
      type === "TRANSFER"
        ? data.transferAccountId !== undefined
          ? data.transferAccountId
          : existing.transferAccountId
        : null;

    // Verificar que las cuentas, la categoría y la suscripción sean del usuario
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    let transferAccountType: AccountType | null = null;
    if (type === "TRANSFER") {
      if (!transferAccountId) {
        return NextResponse.json({ error: "Cuenta destino requerida" }, { status: 400 });
      }
      if (transferAccountId === accountId) {
        return NextResponse.json(
          { error: "Las cuentas deben ser distintas" },
          { status: 400 }
        );
      }
      const transfer = await prisma.account.findFirst({
        where: { id: transferAccountId, userId: user.id },
      });
      if (!transfer) {
        return NextResponse.json(
          { error: "Cuenta destino no encontrada" },
          { status: 404 }
        );
      }
      if (transfer.currency !== account.currency) {
        return NextResponse.json(
          {
            error: `No se puede transferir entre cuentas en ${account.currency} y ${transfer.currency}`,
          },
          { status: 400 }
        );
      }
      transferAccountType = transfer.type;
    }

    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });
      if (!cat) {
        return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
      }
      // La principal solo agrupa; los que ya estaban en una (p. ej. de un
      // respaldo viejo) se pueden seguir guardando sin cambiarla
      if (!cat.parentId && data.categoryId !== existing.categoryId) {
        return NextResponse.json({ error: "Elige una subcategoría" }, { status: 400 });
      }
      // Las internas (ajustes, pago de tarjeta) solo las asigna el sistema
      if (cat.kind === "INTERNAL" && data.categoryId !== existing.categoryId) {
        return NextResponse.json({ error: "Categoría no disponible" }, { status: 400 });
      }
    }

    if (data.subscriptionId) {
      const sub = await prisma.subscription.findFirst({
        where: { id: data.subscriptionId, userId: user.id },
      });
      if (!sub) {
        return NextResponse.json(
          { error: "Suscripción no encontrada" },
          { status: 404 }
        );
      }
    }

    // Monto en la moneda de la cuenta. Si el movimiento ya estaba convertido y
    // no cambian la moneda ni la cuenta, se conserva la tasa con que se guardó
    const currency =
      inputCurrency ?? existing.originalCurrency ?? account.currency;
    if (currency !== account.currency && type === "TRANSFER") {
      return NextResponse.json(
        { error: `El monto debe ir en ${account.currency}, la moneda de la cuenta` },
        { status: 400 }
      );
    }
    const amountChanges =
      data.amount !== undefined ||
      inputCurrency !== undefined ||
      accountAmount !== undefined ||
      accountId !== existing.accountId;
    const resolved = amountChanges
      ? await resolveTransactionAmount(user, {
          amount:
            data.amount ??
            (existing.originalAmount && existing.originalCurrency === currency
              ? existing.originalAmount
              : existing.amount),
          currency,
          accountCurrency: account.currency,
          reuseRate:
            existing.originalCurrency === currency && existing.accountId === accountId
              ? existing.exchangeRate && Number(existing.exchangeRate)
              : null,
          accountAmount,
        })
      : null;
    if (resolved && !resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const amount = resolved?.ok ? resolved.value.amount : existing.amount;

    // Revertir el efecto anterior en los balances y aplicar el nuevo
    const deltas = editEffects(
      {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        accountType: existing.account.type,
        transferAccountId: existing.transferAccountId,
        transferAccountType: existing.transferAccount?.type,
      },
      {
        type,
        amount,
        accountId,
        accountType: account.type,
        transferAccountId,
        transferAccountType,
      }
    );

    const updated = await prisma.$transaction(async (tx) => {
      await applyBalanceDeltas(tx, deltas);
      // Si queda como pago de tarjeta (o lo era sin categoría), lleva la suya
      const cardPaymentCategory =
        type === "TRANSFER" && isCardPayment(account.type, transferAccountType)
          ? await ensureInternalCategory(tx, user.id, "CARD_PAYMENT")
          : undefined;
      return tx.transaction.update({
        where: { id: params.id },
        data: {
          ...fields,
          ...(resolved?.ok && resolved.value),
          transferAccountId,
          ...(cardPaymentCategory && { categoryId: cardPaymentCategory }),
        },
      });
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUser();
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      include: { account: true, transferAccount: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Adjuntos del movimiento (y de sus mensualidades si es MSI padre): los
    // registros se borran en cascada; los archivos, después del commit
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [{ transactionId: existing.id }, { transaction: { msiParentId: existing.id } }],
      },
      select: { storageKey: true },
    });

    await prisma.$transaction(async (tx) => {
      // Si es MSI padre, eliminar también los hijos y revertir balance
      if (existing.isMsi && existing.msiParentId === null && existing.msiInstallments) {
        const children = await tx.transaction.findMany({
          where: { msiParentId: existing.id },
          select: { amount: true },
        });
        await tx.transaction.deleteMany({
          where: { msiParentId: existing.id },
        });
        // Revertir deuda de la tarjeta (sin contar mensualidades ya borradas)
        await tx.account.update({
          where: { id: existing.accountId },
          data: {
            balance: {
              decrement: msiParentRevertAmount({
                totalAmount: existing.amount,
                installments: existing.msiInstallments,
                remainingChildren: children.map((c) => c.amount),
              }),
            },
          },
        });
      } else if (existing.isMsi && existing.msiParentId) {
        // MSI hijo: solo decrementar su monto
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { decrement: existing.amount } },
        });
      } else {
        // Transacción normal: revertir cambio en balance
        await applyBalanceDeltas(
          tx,
          revertEffects({
            type: existing.type,
            amount: existing.amount,
            accountId: existing.accountId,
            accountType: existing.account.type,
            transferAccountId: existing.transferAccountId,
            transferAccountType: existing.transferAccount?.type,
          })
        );
      }

      await tx.transaction.delete({ where: { id: params.id } });
    });
    await deleteStoredFiles(attachments.map((a) => a.storageKey));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete tx error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
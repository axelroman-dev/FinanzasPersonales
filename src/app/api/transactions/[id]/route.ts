import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  applyBalanceDeltas,
  editEffects,
  revertEffects,
} from "@/lib/transaction-balance";

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
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      include: { account: true },
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

    const data = parsed.data;
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
    }

    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });
      if (!cat) {
        return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
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

    // Revertir el efecto anterior en los balances y aplicar el nuevo
    const deltas = editEffects(
      {
        type: existing.type,
        amount: existing.amount,
        accountId: existing.accountId,
        accountType: existing.account.type,
        transferAccountId: existing.transferAccountId,
      },
      {
        type,
        amount: data.amount ?? existing.amount,
        accountId,
        accountType: account.type,
        transferAccountId,
      }
    );

    const updated = await prisma.$transaction(async (tx) => {
      await applyBalanceDeltas(tx, deltas);
      return tx.transaction.update({
        where: { id: params.id },
        data: { ...data, transferAccountId },
      });
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      include: { account: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Si es MSI padre, eliminar también los hijos y revertir balance
      if (existing.isMsi && existing.msiParentId === null && existing.msiInstallments) {
        await tx.transaction.deleteMany({
          where: { msiParentId: existing.id },
        });
        // Revertir deuda de la tarjeta
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { decrement: Number(existing.amount) } },
        });
      } else if (existing.isMsi && existing.msiParentId) {
        // MSI hijo: solo decrementar su monto
        await tx.account.update({
          where: { id: existing.accountId },
          data: { balance: { decrement: Number(existing.amount) } },
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
          })
        );
      }

      await tx.transaction.delete({ where: { id: params.id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete tx error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
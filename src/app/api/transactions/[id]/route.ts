import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const updateSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  amount: z.number().positive().optional(),
  date: z.string().transform((s) => new Date(s)).optional(),
  description: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  accountId: z.string().optional(),
  transferAccountId: z.string().nullable().optional(),
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

    const tx = await prisma.transaction.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json(tx);
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
        if (existing.type === "EXPENSE") {
          if (existing.account.type === "CREDIT") {
            await tx.account.update({
              where: { id: existing.accountId },
              data: { balance: { decrement: Number(existing.amount) } },
            });
          } else {
            await tx.account.update({
              where: { id: existing.accountId },
              data: { balance: { increment: Number(existing.amount) } },
            });
          }
        } else if (existing.type === "INCOME") {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { decrement: Number(existing.amount) } },
          });
        } else if (existing.type === "TRANSFER" && existing.transferAccountId) {
          await tx.account.update({
            where: { id: existing.accountId },
            data: { balance: { increment: Number(existing.amount) } },
          });
          await tx.account.update({
            where: { id: existing.transferAccountId },
            data: { balance: { decrement: Number(existing.amount) } },
          });
        }
      }

      await tx.transaction.delete({ where: { id: params.id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete tx error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DEBIT", "CREDIT", "SAVINGS", "VOUCHER"]).optional(),
  balance: z.number().optional(),
  currency: z.string().length(3).optional(),
  includeInBalance: z.boolean().optional(),
  creditLimit: z.number().nullable().optional(),
  cutoffDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDay: z.number().int().min(1).max(31).nullable().optional(),
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

    // Verificar ownership
    const existing = await prisma.account.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const account = await prisma.account.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const existing = await prisma.account.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    // Contar uso: transacciones donde aparece como accountId o transferAccountId,
    // y suscripciones vinculadas
    const [txCount, subCount] = await Promise.all([
      prisma.transaction.count({
        where: {
          OR: [
            { accountId: params.id },
            { transferAccountId: params.id },
          ],
        },
      }),
      prisma.subscription.count({
        where: { accountId: params.id },
      }),
    ]);

    const totalUsage = txCount + subCount;

    if (totalUsage > 0) {
      const url = new URL(req.url);
      const force = url.searchParams.get("force") === "true";
      if (!force) {
        return NextResponse.json(
          {
            error: "Cuenta en uso",
            txCount,
            subCount,
            message: `Esta cuenta tiene ${txCount} movimiento(s) y ${subCount} suscripción(es) vinculada(s). Usa ?force=true para desvincular y eliminar.`,
          },
          { status: 409 }
        );
      }
      // Forzar: el campo `accountId` es required (no nullable), por lo que
      // las transacciones donde esta cuenta aparece como origen deben borrarse.
      // Las transferencias (donde aparece como destino) pueden desvincularse.
      await prisma.transaction.deleteMany({
        where: { accountId: params.id, type: { not: "TRANSFER" } },
      });
      await prisma.transaction.updateMany({
        where: { transferAccountId: params.id },
        data: { transferAccountId: null },
      });
      await prisma.subscription.deleteMany({
        where: { accountId: params.id },
      });
    }

    await prisma.account.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, deletedTxs: txCount, deletedSubs: subCount });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
}
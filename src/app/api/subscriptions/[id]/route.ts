import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isValidSubscriptionCategory } from "@/lib/subscriptions";
import { chargeDueSubscriptions } from "@/lib/subscription-charges";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  frequency: z.enum(["MONTHLY", "YEARLY"]).optional(),
  billingMonth: z.number().int().min(1).max(12).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  accountId: z.string().optional(),
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
    const existing = await prisma.subscription.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (parsed.data.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: parsed.data.accountId, userId: user.id },
      });
      if (!account) {
        return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
      }
    }
    if (
      parsed.data.categoryId !== undefined &&
      // Las que ya estaban asignadas a una principal se pueden seguir guardando
      parsed.data.categoryId !== existing.categoryId &&
      !(await isValidSubscriptionCategory(user.id, parsed.data.categoryId))
    ) {
      return NextResponse.json(
        { error: "Elige una subcategoría de gasto" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const frequency = data.frequency ?? existing.frequency;
    const billingMonth =
      frequency === "YEARLY"
        ? data.billingMonth !== undefined
          ? data.billingMonth
          : existing.billingMonth
        : null;
    if (frequency === "YEARLY" && !billingMonth) {
      return NextResponse.json({ error: "Elige el mes de cobro" }, { status: 400 });
    }

    // Si cambia cuándo se cobra o se reactiva, el próximo cobro se recalcula
    // desde hoy (sin cobrar las fechas que pasaron mientras tanto)
    const reschedule =
      frequency !== existing.frequency ||
      billingMonth !== existing.billingMonth ||
      (data.billingDay !== undefined && data.billingDay !== existing.billingDay) ||
      (data.isActive === true && !existing.isActive);

    const sub = await prisma.subscription.update({
      where: { id: params.id },
      data: {
        ...data,
        frequency,
        billingMonth,
        ...(reschedule && { nextChargeAt: null }),
      },
    });
    if (reschedule) await chargeDueSubscriptions(user.id);
    return NextResponse.json(sub);
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
    const existing = await prisma.subscription.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    await prisma.subscription.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  billingDay: z.number().int().min(1).max(31),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  accountId: z.string(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const subs = await prisma.subscription.findMany({
      where: { userId: user.id },
      include: { account: { select: { name: true } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(subs);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Verificar que la cuenta pertenece al usuario
    const account = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        amount: parsed.data.amount,
        billingDay: parsed.data.billingDay,
        category: parsed.data.category ?? null,
        isActive: parsed.data.isActive ?? true,
        accountId: parsed.data.accountId,
      },
    });
    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    console.error("Create sub error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
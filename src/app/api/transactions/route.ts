import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createMsiPurchase } from "@/lib/msi";
import { applyBalanceDeltas, balanceEffects } from "@/lib/transaction-balance";

const baseSchema = {
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().positive(),
  // Acepta "YYYY-MM-DD" como local midnight (no UTC midnight)
  date: z.string().transform((s) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return new Date(s + "T00:00:00");
    }
    return new Date(s);
  }),
  description: z.string().min(1),
  category: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  accountId: z.string(),
  transferAccountId: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  isMsi: z.boolean().optional(),
  msiInstallments: z.number().int().min(2).max(48).optional(),
};

const schema = z.object(baseSchema);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const where: any = { userId: user.id };
    if (searchParams.get("from") || searchParams.get("to")) {
      where.date = {};
      if (searchParams.get("from")) where.date.gte = new Date(searchParams.get("from")!);
      if (searchParams.get("to")) {
        const to = new Date(searchParams.get("to")!);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }
    if (searchParams.get("type")) where.type = searchParams.get("type");
    if (searchParams.get("accountId")) {
      where.OR = [
        { accountId: searchParams.get("accountId") },
        { transferAccountId: searchParams.get("accountId") },
      ];
    }
    if (searchParams.get("msi") === "true") where.isMsi = true;
    if (searchParams.get("msi") === "false") where.isMsi = false;

    const txs = await prisma.transaction.findMany({
      where,
      include: {
        account: { select: { name: true } },
        transferAccount: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    });
    return NextResponse.json(txs);
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
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verificar cuenta origen
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Cuenta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar cuenta destino si es transferencia
    if (data.type === "TRANSFER") {
      if (!data.transferAccountId) {
        return NextResponse.json(
          { error: "Cuenta destino requerida" },
          { status: 400 }
        );
      }
      if (data.transferAccountId === data.accountId) {
        return NextResponse.json(
          { error: "Las cuentas deben ser distintas" },
          { status: 400 }
        );
      }
      const transfer = await prisma.account.findFirst({
        where: { id: data.transferAccountId, userId: user.id },
      });
      if (!transfer) {
        return NextResponse.json(
          { error: "Cuenta destino no encontrada" },
          { status: 404 }
        );
      }
    }

    // Verificar categoría si se proporciona
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.id },
      });
      if (!cat) {
        return NextResponse.json(
          { error: "Categoría no encontrada" },
          { status: 404 }
        );
      }
    }

    // MSI: solo gastos en cuenta de crédito
    if (data.isMsi && data.msiInstallments) {
      if (data.type !== "EXPENSE" || account.type !== "CREDIT") {
        return NextResponse.json(
          { error: "MSI solo aplica a gastos en tarjetas de crédito" },
          { status: 400 }
        );
      }

      const result = await createMsiPurchase({
        userId: user.id,
        accountId: data.accountId,
        totalAmount: data.amount,
        installments: data.msiInstallments,
        description: data.description,
        category: data.category ?? undefined,
        categoryId: data.categoryId ?? undefined,
        startDate: data.date,
      });

      return NextResponse.json(result, { status: 201 });
    }

    // Transacción normal
    const tx = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId: user.id,
          type: data.type,
          amount: data.amount,
          date: data.date,
          description: data.description,
          category: data.category ?? null,
          categoryId: data.categoryId ?? null,
          accountId: data.accountId,
          transferAccountId: data.transferAccountId ?? null,
          subscriptionId: data.subscriptionId ?? null,
        },
      });

      // Actualizar balances
      await applyBalanceDeltas(
        tx,
        balanceEffects({
          type: data.type,
          amount: data.amount,
          accountId: data.accountId,
          accountType: account.type,
          transferAccountId: data.transferAccountId,
        })
      );

      return created;
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error("Create tx error:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear" },
      { status: 500 }
    );
  }
}
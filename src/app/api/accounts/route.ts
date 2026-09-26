import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordBalanceChange } from "@/lib/internal-categories";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["DEBIT", "CREDIT", "SAVINGS", "VOUCHER"]),
  balance: z.number(),
  currency: z.string().length(3).default("MXN"),
  includeInBalance: z.boolean().default(true),
  creditLimit: z.number().nullable().optional(),
  cutoffDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDay: z.number().int().min(1).max(31).nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const account = await prisma.$transaction(async (tx) => {
      // La cuenta nace en 0 y el balance entra como movimiento de
      // "Balance inicial", para que quede registrado cuándo se capturó
      const created = await tx.account.create({
        data: {
          userId: user.id,
          name: data.name,
          type: data.type,
          balance: 0,
          currency: data.currency,
          includeInBalance: data.type === "VOUCHER" ? false : data.includeInBalance,
          creditLimit: data.type === "CREDIT" ? data.creditLimit ?? null : null,
          cutoffDay: data.type === "CREDIT" ? data.cutoffDay ?? null : null,
          paymentDay: data.type === "CREDIT" ? data.paymentDay ?? null : null,
        },
      });
      await recordBalanceChange(tx, {
        account: created,
        from: 0,
        to: data.balance,
        key: "INITIAL_BALANCE",
      });
      return tx.account.findUniqueOrThrow({ where: { id: created.id } });
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("Create account error:", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
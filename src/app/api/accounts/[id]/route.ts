import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordBalanceChange } from "@/lib/internal-categories";
import { deleteStoredFiles } from "@/lib/attachments";
import { detachTransfer } from "@/lib/account-deletion";

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

    // El balance no se sobrescribe: la diferencia se registra como un
    // movimiento de "Ajuste de cuenta" (con el tipo de cuenta ya actualizado)
    const { balance, ...data } = parsed.data;
    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id: params.id },
        data,
      });
      if (balance === undefined) return updated;
      const adjustment = await recordBalanceChange(tx, {
        account: updated,
        from: updated.balance,
        to: balance,
        key: "ADJUSTMENT",
      });
      return adjustment
        ? tx.account.findUniqueOrThrow({ where: { id: params.id } })
        : updated;
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

    // Contar uso: movimientos propios de la cuenta, transferencias con otras
    // cuentas y suscripciones vinculadas
    const [ownTxCount, transferCount, subCount] = await Promise.all([
      prisma.transaction.count({
        where: { accountId: params.id, type: { not: "TRANSFER" } },
      }),
      prisma.transaction.count({
        where: {
          type: "TRANSFER",
          OR: [{ accountId: params.id }, { transferAccountId: params.id }],
        },
      }),
      prisma.subscription.count({
        where: { accountId: params.id },
      }),
    ]);
    const txCount = ownTxCount + transferCount;

    const totalUsage = txCount + subCount;

    if (totalUsage > 0) {
      const url = new URL(req.url);
      const force = url.searchParams.get("force") === "true";
      if (!force) {
        return NextResponse.json(
          {
            error: "Cuenta en uso",
            txCount,
            ownTxCount,
            transferCount,
            subCount,
            message: `Esta cuenta tiene ${txCount} movimiento(s) y ${subCount} suscripción(es) vinculada(s). Usa ?force=true para desvincular y eliminar.`,
          },
          { status: 409 }
        );
      }
    }

    // Todo en una transacción: si algo falla no queda nada borrado a medias.
    // - Movimientos propios de la cuenta (no transferencias): se borran
    // - Transferencias con otra cuenta: esa cuenta conserva su mitad como
    //   ingreso o gasto, sin cambiar su balance (ver detachTransfer)
    // - Suscripciones de la cuenta: se borran
    const result = await prisma.$transaction(async (tx) => {
      const transfers = await tx.transaction.findMany({
        where: {
          type: "TRANSFER",
          OR: [{ accountId: params.id }, { transferAccountId: params.id }],
        },
        select: { id: true, accountId: true, transferAccountId: true, description: true },
      });

      const toDelete: string[] = [];
      let converted = 0;
      for (const transfer of transfers) {
        const result = detachTransfer(transfer, existing);
        if (result.action === "delete") {
          toDelete.push(transfer.id);
        } else {
          await tx.transaction.update({ where: { id: transfer.id }, data: result.data });
          converted++;
        }
      }

      const deletedWhere = {
        OR: [
          { accountId: params.id, type: { not: "TRANSFER" as const } },
          { id: { in: toDelete } },
        ],
      };
      // Los registros de adjuntos se borran en cascada; los archivos, después
      const attachments = await tx.attachment.findMany({
        where: { transaction: deletedWhere },
        select: { storageKey: true },
      });
      const { count: deletedTxs } = await tx.transaction.deleteMany({ where: deletedWhere });
      await tx.subscription.deleteMany({ where: { accountId: params.id } });
      await tx.account.delete({ where: { id: params.id } });
      return { deletedTxs, converted, keys: attachments.map((a) => a.storageKey) };
    });
    await deleteStoredFiles(result.keys);

    return NextResponse.json({
      ok: true,
      deletedTxs: result.deletedTxs,
      convertedTransfers: result.converted,
      deletedSubs: subCount,
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Error al eliminar" },
      { status: 500 }
    );
  }
}
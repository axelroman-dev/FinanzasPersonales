/**
 * Corrige los balances de tarjetas de crédito afectados por la regla anterior,
 * en la que pagar la tarjeta, recibir un reembolso o transferir desde ella
 * movía la deuda en el sentido equivocado.
 *
 * Recalcula los movimientos con `balanceRule = 1` usando la regla actual, ajusta
 * los balances y los marca como `balanceRule = 2`. Correrlo otra vez no cambia
 * nada. Ver src/lib/transaction-balance.ts.
 *
 * Uso:
 *   npx tsx scripts/fix-credit-balances.ts            # vista previa, no modifica nada
 *   npx tsx scripts/fix-credit-balances.ts --apply    # aplica la corrección
 *
 * En Docker:
 *   docker compose exec app npx tsx scripts/fix-credit-balances.ts [--apply]
 */
import { PrismaClient, Prisma } from "@prisma/client";
import {
  applyBalanceDeltas,
  balanceEffects,
  CURRENT_BALANCE_RULE,
  mergeDeltas,
  revertEffects,
  type BalanceTx,
} from "../src/lib/transaction-balance";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const money = (n: Prisma.Decimal) =>
  n.toNumber().toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const txs = await prisma.transaction.findMany({
    where: { balanceRule: 1 },
    include: { account: true, transferAccount: true },
  });

  // Los MSI son gastos: se aplican igual con ambas reglas
  const affected = txs.filter((t) => !t.isMsi);
  const txCountByAccount = new Map<string, number>();
  const deltas = mergeDeltas(
    affected.flatMap((t) => {
      const base: BalanceTx = {
        type: t.type,
        amount: t.amount,
        accountId: t.accountId,
        accountType: t.account.type,
        transferAccountId: t.transferAccountId,
        transferAccountType: t.transferAccount?.type,
      };
      const changes = [
        ...revertEffects({ ...base, balanceRule: 1 }),
        ...balanceEffects({ ...base, balanceRule: CURRENT_BALANCE_RULE }),
      ];
      for (const id of new Set(mergeDeltas(changes).map((d) => d.accountId))) {
        txCountByAccount.set(id, (txCountByAccount.get(id) ?? 0) + 1);
      }
      return changes;
    })
  );

  console.log(`Movimientos con la regla anterior: ${txs.length}`);

  if (deltas.length === 0) {
    console.log("Ningún balance cambia.");
  } else {
    const accounts = await prisma.account.findMany({
      where: { id: { in: deltas.map((d) => d.accountId) } },
      include: { user: { select: { email: true } } },
    });
    console.log("");
    for (const { accountId, delta } of deltas) {
      const acc = accounts.find((a) => a.id === accountId)!;
      const before = new Prisma.Decimal(acc.balance);
      console.log(
        `${acc.user.email} · ${acc.name} (${acc.type}): ` +
          `${money(before)} → ${money(before.add(delta))}  ` +
          `(${txCountByAccount.get(accountId)} movimientos)`
      );
    }
    console.log("");
  }

  if (!apply) {
    console.log("Vista previa: no se modificó nada. Usa --apply para corregir.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await applyBalanceDeltas(tx, deltas);
    await tx.transaction.updateMany({
      where: { id: { in: txs.map((t) => t.id) } },
      data: { balanceRule: CURRENT_BALANCE_RULE },
    });
  });
  console.log(`Listo: ${deltas.length} cuentas corregidas, ${txs.length} movimientos migrados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

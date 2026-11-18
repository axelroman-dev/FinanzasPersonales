import type { Account } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { getCategoryTree } from "@/lib/categories";
import { attachmentsEnabled } from "@/lib/storage/crypto";
import { getKnownDescriptions } from "@/lib/known-descriptions";
import { allowedCurrencies } from "@/lib/currencies";
import { getUserConverter } from "@/lib/exchange-rates";
import type { TransactionFormOptions } from "@/components/transactions/transaction-actions";

/**
 * Lo que necesita el formulario de movimientos, para cualquier página que lo
 * abra (movimientos, cuentas)
 */
export async function getTransactionFormOptions(
  user: SessionUser,
  accounts: Account[]
) {
  const [categories, descriptions, converter] = await Promise.all([
    getCategoryTree(user.id),
    getKnownDescriptions(user.id),
    getUserConverter(user),
  ]);

  // Para capturar montos en otra moneda que la cuenta: cuánto vale 1 de cada
  // moneda en la principal, con la tasa de hoy
  const currencies = allowedCurrencies(user);
  const rates: Record<string, number> = {};
  for (const c of new Set([...currencies, ...accounts.map((a) => a.currency)])) {
    const r = converter.rate(c, user.primaryCurrency);
    if (r) rates[c] = r;
  }

  // En los selectores, por nombre
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name));

  return {
    accounts: sorted.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      currency: a.currency,
    })),
    creditAccounts: sorted
      .filter((a) => a.type === "CREDIT")
      .map((a) => ({
        id: a.id,
        name: a.name,
        creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
      })),
    categories,
    attachmentsEnabled: attachmentsEnabled(),
    descriptions,
    currencies,
    rates,
  } satisfies TransactionFormOptions;
}

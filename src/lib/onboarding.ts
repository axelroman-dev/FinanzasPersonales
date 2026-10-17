import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  DEFAULT_RATE_PROVIDER,
  isRateProvider,
  parseManualRates,
} from "@/lib/rate-providers";

/** Configuración inicial de una cuenta nueva (monedas y tipo de cambio) */
export const WELCOME_PATH = "/welcome";

/** Datos para el formulario de monedas (perfil y configuración inicial) */
export async function getCurrencyFormProps(user: SessionUser) {
  const [accounts, saved] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      select: { currency: true },
      distinct: ["currency"],
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { banxicoToken: true } }),
  ]);
  return {
    initialPrimary: user.primaryCurrency,
    initialSecondary: user.secondaryCurrencies,
    initialProvider: isRateProvider(user.ratesProvider)
      ? user.ratesProvider
      : DEFAULT_RATE_PROVIDER,
    initialUrl: user.ratesProviderUrl,
    initialManualRates: parseManualRates(user.manualRates),
    hasBanxicoToken: !!saved?.banxicoToken,
    serverBanxicoToken: !!process.env.BANXICO_TOKEN,
    inUse: accounts.map((a) => a.currency),
  };
}

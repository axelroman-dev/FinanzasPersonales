import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import {
  DEFAULT_RATE_PROVIDER,
  isRateProvider,
  parseManualRates,
  type RateProviderId,
} from "@/lib/rate-providers";

/** Configuración inicial de una cuenta nueva (monedas y tipo de cambio) */
export const WELCOME_PATH = "/welcome";

/** El servidor tiene un token de Banxico para todos (BANXICO_TOKEN) */
export function serverBanxicoToken(): boolean {
  return !!process.env.BANXICO_TOKEN?.trim();
}

/**
 * Proveedor que se sugiere a las cuentas nuevas: Banco de México si el
 * servidor tiene token (nadie tiene que sacar el suyo); si no, el BCE
 */
export function defaultRateProvider(): RateProviderId {
  return serverBanxicoToken() ? "BANXICO" : DEFAULT_RATE_PROVIDER;
}

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
    // Una cuenta nueva aún no elige: arranca con el predeterminado del servidor
    initialProvider:
      !user.onboardedAt || !isRateProvider(user.ratesProvider)
        ? defaultRateProvider()
        : user.ratesProvider,
    defaultProvider: defaultRateProvider(),
    initialUrl: user.ratesProviderUrl,
    initialManualRates: parseManualRates(user.manualRates),
    hasBanxicoToken: !!saved?.banxicoToken,
    serverBanxicoToken: serverBanxicoToken(),
    inUse: accounts.map((a) => a.currency),
  };
}

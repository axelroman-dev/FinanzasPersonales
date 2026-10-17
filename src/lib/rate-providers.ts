import { SUPPORTED_CURRENCIES } from "@/lib/currencies";

/**
 * Proveedores de tipos de cambio que puede elegir cada usuario. Este archivo
 * solo describe a cada uno (se usa también en el navegador); las consultas
 * viven en src/lib/exchange-rates.ts.
 */
export const RATE_PROVIDER_IDS = [
  "ECB",
  "BANXICO",
  "US_TREASURY",
  "OPEN_ER",
  "CUSTOM",
  "MANUAL",
] as const;

export type RateProviderId = (typeof RATE_PROVIDER_IDS)[number];

export const DEFAULT_RATE_PROVIDER: RateProviderId = "ECB";

const ECB_CURRENCIES = SUPPORTED_CURRENCIES.slice(0, 30);

/** Series del SIE de Banxico: pesos por unidad de cada moneda */
export const BANXICO_SERIES: Record<string, string> = {
  USD: "SF43718", // FIX
  EUR: "SF46410",
  JPY: "SF46406",
  GBP: "SF46407",
  CAD: "SF60632",
};

export const RATE_PROVIDERS: Record<
  RateProviderId,
  {
    label: string;
    description: string;
    currencies: readonly string[];
  }
> = {
  ECB: {
    label: "Banco Central Europeo",
    description: "Tasas oficiales, cada día hábil. Sin registro (vía Frankfurter).",
    currencies: ECB_CURRENCIES,
  },
  BANXICO: {
    label: "Banco de México",
    description:
      "Tipo de cambio FIX y otras monedas, cada día hábil. Requiere un token gratuito del SIE.",
    currencies: ["MXN", ...Object.keys(BANXICO_SERIES)],
  },
  US_TREASURY: {
    label: "Tesoro de Estados Unidos",
    description:
      "Tasas oficiales del Departamento del Tesoro, actualizadas cada trimestre. Incluye monedas latinoamericanas.",
    currencies: SUPPORTED_CURRENCIES,
  },
  OPEN_ER: {
    label: "ExchangeRate-API",
    description: "Tasas de mercado, cada día. Más de 150 monedas, sin registro.",
    currencies: SUPPORTED_CURRENCIES,
  },
  CUSTOM: {
    label: "Personalizado",
    description:
      "Tu propia URL que devuelva JSON con { \"rates\": { \"USD\": 0.054, … } } para la moneda base.",
    currencies: SUPPORTED_CURRENCIES,
  },
  MANUAL: {
    label: "Manual",
    description: "Escribes tú el tipo de cambio de cada moneda secundaria.",
    currencies: SUPPORTED_CURRENCIES,
  },
};

export function isRateProvider(id: string): id is RateProviderId {
  return (RATE_PROVIDER_IDS as readonly string[]).includes(id);
}

export function providerLabel(id: string): string {
  return isRateProvider(id) ? RATE_PROVIDERS[id].label : id;
}

/** Tasas manuales: cuánto vale 1 unidad de cada moneda en la moneda base */
export type ManualRates = { base: string; rates: Record<string, number> };

export function parseManualRates(value: unknown): ManualRates | null {
  const v = value as ManualRates | null;
  if (!v || typeof v.base !== "string" || !v.rates || typeof v.rates !== "object") {
    return null;
  }
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(v.rates)) {
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }
  return { base: v.base, rates };
}

/**
 * Para una URL personalizada: reemplaza {base} y {symbols}. Sin marcadores se
 * le agregan como en Frankfurter (/latest?base=…&symbols=…).
 */
export function buildCustomUrl(template: string, base: string, quotes: string[]): string {
  const symbols = quotes.map(encodeURIComponent).join(",");
  if (template.includes("{base}") || template.includes("{symbols}")) {
    return template
      .replaceAll("{base}", encodeURIComponent(base))
      .replaceAll("{symbols}", symbols);
  }
  const url = new URL(template);
  url.searchParams.set("base", base);
  url.searchParams.set("symbols", quotes.join(","));
  return url.toString();
}

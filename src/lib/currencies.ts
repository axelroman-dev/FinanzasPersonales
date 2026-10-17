/**
 * Monedas que se pueden elegir como principal o secundaria. Cada proveedor de
 * tipos de cambio publica solo algunas (ver src/lib/rate-providers.ts): una
 * moneda que el proveedor no publica no se podría convertir a la principal.
 */
export const SUPPORTED_CURRENCIES = [
  // Las que publica el Banco Central Europeo
  "MXN", "USD", "EUR", "CAD", "GBP", "JPY", "BRL", "CHF", "CNY", "AUD",
  "NZD", "HKD", "SGD", "KRW", "INR", "IDR", "MYR", "PHP", "THB", "TRY",
  "ZAR", "ILS", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON",
  // Latinoamérica y otras (Tesoro de EE. UU., ExchangeRate-API, manual…)
  "ARS", "COP", "CLP", "PEN", "UYU", "BOB", "PYG", "GTQ", "CRC", "DOP",
  "HNL", "NIO", "TWD", "AED", "SAR", "EGP", "VND",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "MXN";

/** Máximo de monedas secundarias por usuario */
export const MAX_SECONDARY_CURRENCIES = 8;

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export type CurrencySettings = {
  primaryCurrency: string;
  secondaryCurrencies: string[];
};

/** Monedas que pueden usar las cuentas del usuario: la principal primero */
export function allowedCurrencies(settings: CurrencySettings): string[] {
  return [
    settings.primaryCurrency,
    ...settings.secondaryCurrencies.filter((c) => c !== settings.primaryCurrency),
  ];
}

/** "USD · dólar estadounidense" */
export function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames("es", { type: "currency" }).of(code);
    return name && name !== code ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

/**
 * Valida y normaliza un cambio de monedas. `inUse` son las monedas de las
 * cuentas del usuario: ninguna puede quedar fuera, así que si la principal
 * anterior está en uso pasa sola a secundaria.
 */
export function normalizeCurrencySettings(params: {
  primary: string;
  secondary: string[];
  previousPrimary: string;
  inUse: string[];
  /** Monedas que publica el proveedor elegido (todas si se omite) */
  supported?: readonly string[];
  /** Nombre del proveedor para los mensajes de error */
  providerLabel?: string;
}): { ok: true; settings: CurrencySettings } | { ok: false; error: string } {
  const supported = params.supported ?? SUPPORTED_CURRENCIES;
  const unsupported = (code: string) =>
    params.providerLabel && isSupportedCurrency(code)
      ? `${params.providerLabel} no publica ${code}`
      : `Moneda no soportada: ${code}`;
  const primary = params.primary.toUpperCase();
  if (!supported.includes(primary)) {
    return { ok: false, error: unsupported(primary) };
  }

  const secondary: string[] = [];
  for (const raw of params.secondary) {
    const code = raw.toUpperCase();
    // Una moneda sin tipo de cambio solo se conserva si ya hay cuentas en ella
    // (p. ej. de antes de existir esta lista)
    if (!supported.includes(code) && !params.inUse.includes(code)) {
      return { ok: false, error: unsupported(code) };
    }
    if (code !== primary && !secondary.includes(code)) secondary.push(code);
  }

  const previous = params.previousPrimary;
  if (previous !== primary && params.inUse.includes(previous) && !secondary.includes(previous)) {
    secondary.push(previous);
  }

  const missing = params.inUse.filter((c) => c !== primary && !secondary.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `No puedes quitar ${missing.join(", ")}: hay cuentas que la usan`,
    };
  }

  if (secondary.length > MAX_SECONDARY_CURRENCIES) {
    return {
      ok: false,
      error: `Máximo ${MAX_SECONDARY_CURRENCIES} monedas secundarias`,
    };
  }

  return { ok: true, settings: { primaryCurrency: primary, secondaryCurrencies: secondary } };
}

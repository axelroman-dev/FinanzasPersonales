import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { prisma } from "@/lib/db";
import { allowedCurrencies, type CurrencySettings } from "@/lib/currencies";
import {
  BANXICO_SERIES,
  buildCustomUrl,
  isRateProvider,
  parseManualRates,
  providerLabel,
  type RateProviderId,
} from "@/lib/rate-providers";

/**
 * Tipos de cambio para convertir los totales a la moneda principal. Cada
 * usuario elige el proveedor (ver src/lib/rate-providers.ts); lo consultado se
 * guarda en ExchangeRate y si el proveedor no responde se usa lo último
 * guardado. Siempre es la tasa vigente, también para reportes de meses
 * pasados.
 */

const ECB_DEFAULT_URL = "https://api.frankfurter.dev/v1";
// Los proveedores publican a lo más una vez al día
export const RATES_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
// Tras un fallo no se reintenta en cada request
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

export type CachedRate = { quote: string; rate: number; fetchedAt: Date };

/** Configuración de monedas y proveedor de un usuario */
export type RateSettings = CurrencySettings & {
  ratesProvider: string;
  ratesProviderUrl: string | null;
  manualRates: unknown;
  manualRatesAt: Date | null;
};

/** true si falta alguna moneda o alguna tasa ya es vieja */
export function needsRefresh(cached: CachedRate[], quotes: string[], now: Date): boolean {
  return quotes.some((q) => {
    const row = cached.find((c) => c.quote === q);
    return !row || now.getTime() - row.fetchedAt.getTime() > RATES_MAX_AGE_MS;
  });
}

/**
 * Tasas válidas de una respuesta tipo Frankfurter (1 base = rate quote).
 * También acepta `conversion_rates` (ExchangeRate-API con key).
 */
export function parseRatesResponse(json: unknown, quotes: string[]): Map<string, number> {
  const result = new Map<string, number>();
  const obj = json as { rates?: unknown; conversion_rates?: unknown } | null;
  const rates = (obj?.rates ?? obj?.conversion_rates) as Record<string, unknown> | undefined;
  if (!rates || typeof rates !== "object") return result;
  for (const q of quotes) {
    const r = rates[q];
    if (typeof r === "number" && Number.isFinite(r) && r > 0) result.set(q, r);
  }
  return result;
}

/**
 * Tasas cruzadas desde una moneda pivote: `perPivot[X]` = cuántas X vale 1
 * unidad del pivote. Devuelve 1 base = rate quote.
 */
export function crossRates(
  perPivot: Map<string, number>,
  base: string,
  quotes: string[]
): Map<string, number> {
  const result = new Map<string, number>();
  const baseRate = perPivot.get(base);
  if (!baseRate) return result;
  for (const q of quotes) {
    const r = perPivot.get(q);
    if (r) result.set(q, r / baseRate);
  }
  return result;
}

/** Nombres con que el Tesoro de EE. UU. identifica cada moneda */
const TREASURY_NAMES: Record<string, string> = {
  MXN: "Mexico-Peso",
  EUR: "Euro Zone-Euro",
  CAD: "Canada-Dollar",
  GBP: "United Kingdom-Pound",
  JPY: "Japan-Yen",
  BRL: "Brazil-Real",
  CHF: "Switzerland-Franc",
  CNY: "China-Renminbi",
  AUD: "Australia-Dollar",
  NZD: "New Zealand-Dollar",
  HKD: "Hong Kong-Dollar",
  SGD: "Singapore-Dollar",
  KRW: "Korea-Won",
  INR: "India-Rupee",
  IDR: "Indonesia-Rupiah",
  MYR: "Malaysia-Ringgit",
  PHP: "Philippines-Peso",
  THB: "Thailand-Baht",
  TRY: "Turkey-New Lira",
  ZAR: "South Africa-Rand",
  ILS: "Israel-Shekel",
  SEK: "Sweden-Krona",
  NOK: "Norway-Krone",
  DKK: "Denmark-Krone",
  ISK: "Iceland-Krona",
  PLN: "Poland-Zloty",
  CZK: "Czech Republic-Koruna",
  HUF: "Hungary-Forint",
  RON: "Romania-New Leu",
  ARS: "Argentina-Peso",
  COP: "Colombia-Peso",
  CLP: "Chile-Peso",
  PEN: "Peru-Sol",
  UYU: "Uruguay-Peso",
  BOB: "Bolivia-Boliviano",
  PYG: "Paraguay-Guarani",
  GTQ: "Guatemala-Quetzal",
  CRC: "Costa Rica-Colon",
  DOP: "Dominican Republic-Peso",
  HNL: "Honduras-Lempira",
  NIO: "Nicaragua-Cordoba",
  TWD: "Taiwan-Dollar",
  AED: "United Arab Emirates-Dirham",
  SAR: "Saudi Arabia-Riyal",
  EGP: "Egypt-Pound",
  VND: "Vietnam-Dong",
};

/** Unidades de cada moneda por 1 USD, con el registro más reciente de cada una */
export function parseTreasury(json: unknown): Map<string, number> {
  const rows = (json as { data?: unknown[] } | null)?.data;
  const latest = new Map<string, { date: string; rate: number }>();
  if (Array.isArray(rows)) {
    for (const row of rows as Record<string, unknown>[]) {
      const desc = String(row.country_currency_desc ?? "");
      const date = String(row.record_date ?? "");
      const rate = Number(row.exchange_rate);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      const prev = latest.get(desc);
      if (!prev || date > prev.date) latest.set(desc, { date, rate });
    }
  }
  const perUsd = new Map<string, number>([["USD", 1]]);
  for (const [code, desc] of Object.entries(TREASURY_NAMES)) {
    const row = latest.get(desc);
    if (row) perUsd.set(code, row.rate);
  }
  return perUsd;
}

/** Unidades de cada moneda por 1 MXN a partir de las series del SIE */
export function parseBanxico(json: unknown): Map<string, number> {
  const series = (json as { bmx?: { series?: unknown[] } } | null)?.bmx?.series;
  const perMxn = new Map<string, number>([["MXN", 1]]);
  if (!Array.isArray(series)) return perMxn;
  for (const s of series as { idSerie?: string; datos?: { dato?: string }[] }[]) {
    const code = Object.keys(BANXICO_SERIES).find((c) => BANXICO_SERIES[c] === s.idSerie);
    const raw = s.datos?.[s.datos.length - 1]?.dato;
    const pesos = raw ? Number(raw.replace(/,/g, "")) : NaN;
    if (code && Number.isFinite(pesos) && pesos > 0) perMxn.set(code, 1 / pesos);
  }
  return perMxn;
}

export type Converter = {
  base: string;
  /** Nombre del proveedor, para la nota bajo los totales */
  provider: string;
  /** Fecha de la tasa más antigua que se usó; null si no hubo conversiones */
  fetchedAt: Date | null;
  /** Monedas sin tasa: sus montos quedan fuera de los totales */
  missing: Set<string>;
  /** Convierte a la moneda principal; 0 (y la anota en missing) si no hay tasa */
  toBase(amount: number, currency: string): number;
  /** Cuántas `to` vale 1 `from`; null si falta alguna tasa */
  rate(from: string, to: string): number | null;
};

export function makeConverter(
  base: string,
  rates: CachedRate[],
  provider = providerLabel("ECB")
): Converter {
  const byQuote = new Map(rates.map((r) => [r.quote, r]));
  const converter: Converter = {
    base,
    provider,
    fetchedAt: null,
    missing: new Set(),
    toBase(amount, currency) {
      if (currency === base) return amount;
      const row = byQuote.get(currency);
      if (!row) {
        converter.missing.add(currency);
        return 0;
      }
      if (!converter.fetchedAt || row.fetchedAt < converter.fetchedAt) {
        converter.fetchedAt = row.fetchedAt;
      }
      return amount / row.rate;
    },
    rate(from, to) {
      if (from === to) return 1;
      const perBase = (c: string) => (c === base ? 1 : byQuote.get(c)?.rate ?? null);
      const f = perBase(from);
      const t = perBase(to);
      return f && t ? t / f : null;
    },
  };
  return converter;
}

/** Tasas manuales (1 X vale N base) como tasas de caché (1 base = rate X) */
export function manualCachedRates(
  base: string,
  manualRates: unknown,
  at: Date | null
): CachedRate[] {
  const manual = parseManualRates(manualRates);
  // Se capturaron para otra principal: ya no valen
  if (!manual || manual.base !== base) return [];
  return Object.entries(manual.rates).map(([quote, value]) => ({
    quote,
    rate: 1 / value,
    fetchedAt: at ?? new Date(),
  }));
}

// ── URLs personalizadas ──

/** IPs de la red local o del propio servidor */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe80")
  );
}

/**
 * Valida la URL de un proveedor personalizado. El servidor la consulta en
 * nombre del usuario, así que no puede apuntar a la red interna (salvo con
 * ALLOW_PRIVATE_RATE_URLS=true, p. ej. para un Frankfurter propio en la LAN).
 * Devuelve el mensaje de error, o null si es válida.
 */
export async function validateCustomUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(buildCustomUrl(raw, "USD", ["EUR"]));
  } catch {
    return "La URL no es válida";
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_RATE_URLS === "true";
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) {
    return "La URL debe empezar con https://";
  }
  if (url.username || url.password) return "La URL no puede llevar usuario ni contraseña";
  if (allowPrivate) return null;
  try {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return "La URL apunta a una red privada";
    }
  } catch {
    return "No se encontró el servidor de la URL";
  }
  return null;
}

// ── Consultas a cada proveedor ──

type FetchContext = { url?: string | null; token?: string | null };

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const fetchers: Record<
  Exclude<RateProviderId, "MANUAL">,
  (base: string, quotes: string[], ctx: FetchContext) => Promise<Map<string, number>>
> = {
  async ECB(base, quotes) {
    const url = (process.env.EXCHANGE_RATES_URL || ECB_DEFAULT_URL).replace(/\/+$/, "");
    const json = await getJson(
      `${url}/latest?base=${encodeURIComponent(base)}&symbols=${quotes.map(encodeURIComponent).join(",")}`
    );
    return parseRatesResponse(json, quotes);
  },

  async OPEN_ER(base, quotes) {
    const json = (await getJson(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`
    )) as { result?: string };
    if (json?.result !== "success") throw new Error("respuesta inválida");
    return parseRatesResponse(json, quotes);
  },

  async US_TREASURY(base, quotes) {
    // Publica cada trimestre: con poco más de un año de registros alcanza
    const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const json = await getJson(
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange" +
        `?fields=country_currency_desc,exchange_rate,record_date&filter=record_date:gte:${since}` +
        "&sort=-record_date&page%5Bsize%5D=1000"
    );
    return crossRates(parseTreasury(json), base, quotes);
  },

  async BANXICO(base, quotes, ctx) {
    const token = ctx.token || process.env.BANXICO_TOKEN;
    if (!token) throw new Error("falta el token del SIE");
    const ids = [base, ...quotes]
      .map((c) => BANXICO_SERIES[c])
      .filter(Boolean)
      .join(",");
    if (!ids) return new Map();
    const json = await getJson(
      `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${ids}/datos/oportuno`,
      { headers: { "Bmx-Token": token, Accept: "application/json" } }
    );
    return crossRates(parseBanxico(json), base, quotes);
  },

  async CUSTOM(base, quotes, ctx) {
    if (!ctx.url) throw new Error("falta la URL");
    const invalid = await validateCustomUrl(ctx.url);
    if (invalid) throw new Error(invalid);
    // Sin seguir redirecciones: podrían llevar a la red interna
    const json = await getJson(buildCustomUrl(ctx.url, base, quotes), { redirect: "error" });
    return parseRatesResponse(json, quotes);
  },
};

/** Clave de caché: una URL personalizada distinta es otro proveedor */
function cacheKey(provider: RateProviderId, url: string | null): string {
  if (provider !== "CUSTOM") return provider;
  return `CUSTOM:${createHash("sha256").update(url ?? "").digest("hex").slice(0, 16)}`;
}

/**
 * Consulta al proveedor sin usar la caché, para validar la configuración
 * antes de guardarla. Devuelve las monedas que no publicó, o el error.
 */
export async function testProvider(
  provider: RateProviderId,
  base: string,
  quotes: string[],
  ctx: FetchContext
): Promise<{ ok: true; missing: string[] } | { ok: false; error: string }> {
  if (provider === "MANUAL" || quotes.length === 0) return { ok: true, missing: [] };
  try {
    const rates = await fetchers[provider](base, quotes, ctx);
    return { ok: true, missing: quotes.filter((q) => !rates.has(q)) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `No se pudo consultar ${providerLabel(provider)}: ${msg}` };
  }
}

const lastFailure = new Map<string, number>();

async function loadRates(
  provider: Exclude<RateProviderId, "MANUAL">,
  base: string,
  quotes: string[],
  ctx: FetchContext
): Promise<CachedRate[]> {
  if (quotes.length === 0) return [];

  const key = cacheKey(provider, ctx.url ?? null);
  const rows = await prisma.exchangeRate.findMany({
    where: { provider: key, base, quote: { in: quotes } },
  });
  let cached: CachedRate[] = rows.map((r) => ({
    quote: r.quote,
    rate: Number(r.rate),
    fetchedAt: r.fetchedAt,
  }));

  const now = new Date();
  const failureKey = `${key}:${base}:${quotes.join(",")}`;
  const failedAt = lastFailure.get(failureKey);
  if (
    needsRefresh(cached, quotes, now) &&
    (!failedAt || now.getTime() - failedAt > RETRY_AFTER_FAILURE_MS)
  ) {
    try {
      const fresh = await fetchers[provider](base, quotes, ctx);
      await prisma.$transaction(
        [...fresh].map(([quote, rate]) =>
          prisma.exchangeRate.upsert({
            where: { provider_base_quote: { provider: key, base, quote } },
            create: { provider: key, base, quote, rate, fetchedAt: now },
            update: { rate, fetchedAt: now },
          })
        )
      );
      cached = [
        ...cached.filter((c) => !fresh.has(c.quote)),
        ...[...fresh].map(([quote, rate]) => ({ quote, rate, fetchedAt: now })),
      ];
      lastFailure.delete(failureKey);
    } catch (error) {
      lastFailure.set(failureKey, now.getTime());
      console.error(`No se pudieron actualizar los tipos de cambio (${key}, ${base}):`, error);
    }
  }

  return cached;
}

/**
 * Convertidor a la moneda principal del usuario con su proveedor. Incluye las
 * secundarias y cualquier otra moneda que se pase en `extra`.
 */
export async function getConverter(
  userId: string,
  settings: RateSettings,
  extra: string[] = []
): Promise<Converter> {
  const base = settings.primaryCurrency;
  const provider: RateProviderId = isRateProvider(settings.ratesProvider)
    ? settings.ratesProvider
    : "ECB";
  const quotes = [...new Set([...settings.secondaryCurrencies, ...extra])]
    .filter((c) => c !== base)
    .sort();

  if (provider === "MANUAL") {
    return makeConverter(
      base,
      manualCachedRates(base, settings.manualRates, settings.manualRatesAt),
      providerLabel(provider)
    );
  }

  // El token solo se lee aquí: no viaja con el usuario de la sesión
  const token =
    provider === "BANXICO"
      ? (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { banxicoToken: true },
          })
        )?.banxicoToken
      : null;
  const rates = await loadRates(provider, base, quotes, {
    url: settings.ratesProviderUrl,
    token,
  });
  return makeConverter(base, rates, providerLabel(provider));
}

/**
 * Convertidor para las páginas del usuario: además de sus secundarias incluye
 * las monedas de sus cuentas, por si alguna quedó fuera (p. ej. al importar).
 */
export async function getUserConverter(
  user: RateSettings & { id: string }
): Promise<Converter> {
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { currency: true },
    distinct: ["currency"],
  });
  return getConverter(
    user.id,
    user,
    accounts.map((a) => a.currency)
  );
}

/**
 * Monto en la moneda de la cuenta para uno capturado en otra (p. ej. 20 USD
 * cobrados a una tarjeta en pesos), redondeado a centavos; null si no hay
 * tipo de cambio.
 */
export function convertAmount(
  amount: Prisma.Decimal | number | string,
  from: string,
  to: string,
  rate: (from: string, to: string) => number | null
): { amount: Prisma.Decimal; rate: number | null } | null {
  const original = new Prisma.Decimal(amount);
  if (from === to) return { amount: original, rate: null };
  const r = rate(from, to);
  if (!r) return null;
  return {
    amount: original.mul(r).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    rate: r,
  };
}

/** Monto de un movimiento ya en la moneda de su cuenta, con el original si se convirtió */
export type ResolvedAmount = {
  amount: Prisma.Decimal;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
};

/**
 * Para guardar un movimiento capturado en `currency`: si no es la de la
 * cuenta, lo convierte con el tipo de cambio de hoy del proveedor del usuario
 * (o con `reuseRate`, la tasa con que se guardó, al editarlo).
 */
export async function resolveTransactionAmount(
  user: RateSettings & { id: string },
  params: {
    amount: number | Prisma.Decimal;
    currency: string | null | undefined;
    accountCurrency: string;
    reuseRate?: number | null;
  }
): Promise<{ ok: true; value: ResolvedAmount } | { ok: false; error: string }> {
  const { amount, accountCurrency } = params;
  const currency = params.currency ?? accountCurrency;
  if (currency === accountCurrency) {
    return {
      ok: true,
      value: {
        amount: new Prisma.Decimal(amount),
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
      },
    };
  }
  if (!allowedCurrencies(user).includes(currency)) {
    return { ok: false, error: `Agrega ${currency} a tus monedas en Mi perfil para usarla` };
  }
  const reuse = params.reuseRate;
  const converter = reuse ? null : await getUserConverter(user);
  const converted = convertAmount(amount, currency, accountCurrency, (f, t) =>
    reuse ? reuse : converter!.rate(f, t)
  );
  if (!converted) {
    return {
      ok: false,
      error: `No hay tipo de cambio de ${currency} a ${accountCurrency}; revisa tu proveedor en Mi perfil`,
    };
  }
  return {
    ok: true,
    value: {
      amount: converted.amount,
      originalAmount: Number(amount),
      originalCurrency: currency,
      exchangeRate: converted.rate,
    },
  };
}

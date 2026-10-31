/**
 * Wishlist: productos por comprar con su link a la tienda. El precio se
 * captura a mano; al cambiarlo, el anterior se guarda para mostrar si bajó o
 * subió. El total suma lo pendiente (sin los comprados) en la moneda
 * principal.
 */

/** Tienda conocida por el dominio del link, para la etiqueta */
const STORES: { label: string; pattern: RegExp }[] = [
  { label: "Amazon", pattern: /(^|\.)amazon\.[a-z.]+$|(^|\.)amzn\.(to|eu)$|^a\.co$/ },
  { label: "MercadoLibre", pattern: /(^|\.)mercadoli[bv]re\.[a-z.]+$|(^|\.)meli\.la$/ },
];

/**
 * Link listo para guardar: agrega https:// si falta y solo acepta http(s).
 * null si no es un link válido.
 */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** "Amazon", "MercadoLibre" o el dominio sin www */
export function storeLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return STORES.find((s) => s.pattern.test(host))?.label ?? host;
  } catch {
    return "";
  }
}

/** Cambio respecto al precio anterior, en %; null si no hay anterior o no cambió */
export function priceChangePercent(price: number, previous: number | null): number | null {
  if (previous === null || previous <= 0 || price === previous) return null;
  return ((price - previous) / previous) * 100;
}

export function reachedTarget(price: number, target: number | null): boolean {
  return target !== null && price <= target;
}

export type WishlistSummaryItem = {
  price: number;
  currency: string;
  targetPrice: number | null;
  purchased: boolean;
};

/**
 * Totales de lo pendiente en la moneda principal. `toBase` es el del
 * convertidor del usuario (0 si falta la tasa).
 */
export function summarizeWishlist(
  items: WishlistSummaryItem[],
  toBase: (amount: number, currency: string) => number
) {
  const pending = items.filter((i) => !i.purchased);
  return {
    pendingCount: pending.length,
    total: pending.reduce((sum, i) => sum + toBase(i.price, i.currency), 0),
    atTargetCount: pending.filter((i) => reachedTarget(i.price, i.targetPrice)).length,
  };
}

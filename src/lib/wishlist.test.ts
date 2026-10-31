import { describe, expect, it } from "vitest";
import {
  normalizeUrl,
  priceChangePercent,
  reachedTarget,
  storeLabel,
  summarizeWishlist,
} from "./wishlist";

describe("normalizeUrl", () => {
  it("agrega https:// si falta", () => {
    expect(normalizeUrl("amazon.com.mx/dp/B0BSHF7WHW")).toBe(
      "https://amazon.com.mx/dp/B0BSHF7WHW"
    );
  });

  it("conserva links completos", () => {
    expect(normalizeUrl("  https://articulo.mercadolibre.com.mx/MLM-123  ")).toBe(
      "https://articulo.mercadolibre.com.mx/MLM-123"
    );
  });

  it("rechaza esquemas que no son http(s) y texto que no es link", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,hola")).toBeNull();
    expect(normalizeUrl("audífonos")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("storeLabel", () => {
  it("reconoce Amazon y MercadoLibre, incluso links cortos", () => {
    expect(storeLabel("https://www.amazon.com.mx/dp/X")).toBe("Amazon");
    expect(storeLabel("https://amzn.to/abc")).toBe("Amazon");
    expect(storeLabel("https://articulo.mercadolibre.com.mx/MLM-1")).toBe("MercadoLibre");
    expect(storeLabel("https://www.mercadolivre.com.br/p/MLB1")).toBe("MercadoLibre");
    expect(storeLabel("https://meli.la/abc")).toBe("MercadoLibre");
  });

  it("otras tiendas: el dominio sin www", () => {
    expect(storeLabel("https://www.liverpool.com.mx/tienda/pdp/1")).toBe("liverpool.com.mx");
  });

  it("no confunde dominios que solo contienen el nombre", () => {
    expect(storeLabel("https://amazon.ofertas-falsas.com/x")).toBe("amazon.ofertas-falsas.com");
  });
});

describe("priceChangePercent", () => {
  it("negativo si bajó, positivo si subió", () => {
    expect(priceChangePercent(800, 1000)).toBe(-20);
    expect(priceChangePercent(1100, 1000)).toBeCloseTo(10);
  });

  it("null sin precio anterior o sin cambio", () => {
    expect(priceChangePercent(800, null)).toBeNull();
    expect(priceChangePercent(800, 800)).toBeNull();
  });
});

describe("reachedTarget", () => {
  it("true si el precio es menor o igual al objetivo", () => {
    expect(reachedTarget(900, 900)).toBe(true);
    expect(reachedTarget(901, 900)).toBe(false);
    expect(reachedTarget(10, null)).toBe(false);
  });
});

describe("summarizeWishlist", () => {
  it("suma lo pendiente convertido y no cuenta lo comprado", () => {
    const toBase = (amount: number, currency: string) =>
      currency === "USD" ? amount * 20 : amount;
    const summary = summarizeWishlist(
      [
        { price: 1000, currency: "MXN", targetPrice: 1200, purchased: false },
        { price: 50, currency: "USD", targetPrice: null, purchased: false },
        { price: 5000, currency: "MXN", targetPrice: null, purchased: true },
      ],
      toBase
    );
    expect(summary).toEqual({ pendingCount: 2, total: 2000, atTargetCount: 1 });
  });
});

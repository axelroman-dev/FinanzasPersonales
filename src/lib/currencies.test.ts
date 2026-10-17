import { describe, expect, it } from "vitest";
import { allowedCurrencies, normalizeCurrencySettings } from "./currencies";

describe("allowedCurrencies", () => {
  it("pone la principal primero y no la repite", () => {
    expect(
      allowedCurrencies({ primaryCurrency: "MXN", secondaryCurrencies: ["USD", "MXN"] })
    ).toEqual(["MXN", "USD"]);
  });
});

describe("normalizeCurrencySettings", () => {
  const base = { previousPrimary: "MXN", inUse: [] as string[] };

  it("normaliza mayúsculas, quita duplicados y la principal de las secundarias", () => {
    expect(
      normalizeCurrencySettings({ ...base, primary: "usd", secondary: ["eur", "EUR", "USD"] })
    ).toEqual({ ok: true, settings: { primaryCurrency: "USD", secondaryCurrencies: ["EUR"] } });
  });

  it("rechaza monedas que el proveedor no publica", () => {
    expect(
      normalizeCurrencySettings({
        ...base,
        primary: "ARS",
        secondary: [],
        supported: ["MXN", "USD"],
        providerLabel: "Banco de México",
      })
    ).toEqual({ ok: false, error: "Banco de México no publica ARS" });
    expect(normalizeCurrencySettings({ ...base, primary: "MXN", secondary: ["XXX"] }).ok).toBe(
      false
    );
  });

  it("la principal anterior pasa a secundaria si hay cuentas en ella", () => {
    expect(
      normalizeCurrencySettings({ primary: "USD", secondary: [], previousPrimary: "MXN", inUse: ["MXN"] })
    ).toEqual({ ok: true, settings: { primaryCurrency: "USD", secondaryCurrencies: ["MXN"] } });
  });

  it("no deja quitar una moneda con cuentas", () => {
    const r = normalizeCurrencySettings({ ...base, primary: "MXN", secondary: [], inUse: ["EUR"] });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("EUR") });
  });

  it("conserva una moneda antigua sin tipo de cambio si hay cuentas en ella", () => {
    expect(
      normalizeCurrencySettings({ ...base, primary: "MXN", secondary: ["XYZ"], inUse: ["XYZ"] })
    ).toEqual({ ok: true, settings: { primaryCurrency: "MXN", secondaryCurrencies: ["XYZ"] } });
  });

  it("limita las secundarias", () => {
    const many = ["USD", "EUR", "CAD", "GBP", "JPY", "BRL", "CHF", "CNY", "AUD"];
    expect(normalizeCurrencySettings({ ...base, primary: "MXN", secondary: many }).ok).toBe(false);
  });
});

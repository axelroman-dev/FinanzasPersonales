import { describe, expect, it } from "vitest";
import { convertAmount, makeConverter, resolveTransactionAmount } from "./exchange-rates";

const now = new Date("2026-10-16T12:00:00Z");

describe("convertAmount", () => {
  it("cobra tal cual si la suscripción está en la moneda de la cuenta", () => {
    const r = convertAmount(20, "MXN", "MXN", () => null);
    expect(r?.amount.toNumber()).toBe(20);
    expect(r?.rate).toBeNull();
  });

  it("convierte 20 USD a pesos con la tasa del día, a centavos", () => {
    // Principal MXN: 1 MXN = 0.056 USD → 1 USD ≈ 17.857 MXN
    const c = makeConverter("MXN", [{ quote: "USD", rate: 0.056, fetchedAt: now }]);
    const r = convertAmount(20, "USD", "MXN", c.rate);
    expect(r?.amount.toNumber()).toBe(357.14);
    expect(r?.rate).toBeCloseTo(17.857, 3);
  });

  it("convierte entre dos secundarias pasando por la principal", () => {
    // 1 MXN = 0.05 USD = 0.04 EUR → 1 USD = 0.8 EUR
    const c = makeConverter("MXN", [
      { quote: "USD", rate: 0.05, fetchedAt: now },
      { quote: "EUR", rate: 0.04, fetchedAt: now },
    ]);
    expect(convertAmount(10, "USD", "EUR", c.rate)?.amount.toNumber()).toBe(8);
  });

  it("no cobra sin tipo de cambio", () => {
    const c = makeConverter("MXN", []);
    expect(convertAmount(20, "USD", "MXN", c.rate)).toBeNull();
  });
});

describe("resolveTransactionAmount", () => {
  const user = {
    id: "u1",
    primaryCurrency: "MXN",
    secondaryCurrencies: ["USD"],
    ratesProvider: "MANUAL",
    ratesProviderUrl: null,
    manualRates: null,
    manualRatesAt: null,
  };

  it("en la moneda de la cuenta no convierte ni guarda el original", async () => {
    const r = await resolveTransactionAmount(user, {
      amount: 150,
      currency: "MXN",
      accountCurrency: "MXN",
    });
    expect(r).toEqual({
      ok: true,
      value: {
        amount: expect.anything(),
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
      },
    });
    if (r.ok) expect(r.value.amount.toNumber()).toBe(150);
  });

  it("rechaza monedas que el usuario no tiene", async () => {
    const r = await resolveTransactionAmount(user, {
      amount: 10,
      currency: "EUR",
      accountCurrency: "MXN",
    });
    expect(r.ok).toBe(false);
  });

  it("al editar conserva la tasa con que se guardó", async () => {
    const r = await resolveTransactionAmount(user, {
      amount: 25,
      currency: "USD",
      accountCurrency: "MXN",
      reuseRate: 18,
    });
    expect(r.ok && r.value.amount.toNumber()).toBe(450);
    expect(r.ok && r.value).toMatchObject({
      originalAmount: 25,
      originalCurrency: "USD",
      exchangeRate: 18,
    });
  });
});

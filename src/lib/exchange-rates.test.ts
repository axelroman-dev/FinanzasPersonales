import { describe, expect, it } from "vitest";
import {
  RATES_MAX_AGE_MS,
  crossRates,
  isPrivateAddress,
  makeConverter,
  manualCachedRates,
  needsRefresh,
  parseBanxico,
  parseRatesResponse,
  parseTreasury,
} from "./exchange-rates";
import { buildCustomUrl } from "./rate-providers";

const now = new Date("2026-10-16T12:00:00Z");

describe("needsRefresh", () => {
  it("pide tasas si falta alguna moneda o alguna ya es vieja", () => {
    const fresh = { quote: "USD", rate: 0.054, fetchedAt: now };
    const old = { quote: "EUR", rate: 0.048, fetchedAt: new Date(now.getTime() - RATES_MAX_AGE_MS - 1) };
    expect(needsRefresh([fresh], ["USD"], now)).toBe(false);
    expect(needsRefresh([fresh], ["USD", "EUR"], now)).toBe(true);
    expect(needsRefresh([fresh, old], ["USD", "EUR"], now)).toBe(true);
    expect(needsRefresh([], [], now)).toBe(false);
  });
});

describe("parseRatesResponse", () => {
  it("toma solo las monedas pedidas con tasas válidas", () => {
    const rates = parseRatesResponse(
      { base: "MXN", rates: { USD: 0.054, EUR: 0, GBP: "x", JPY: 8.1 } },
      ["USD", "EUR", "GBP"]
    );
    expect([...rates]).toEqual([["USD", 0.054]]);
  });

  it("tolera respuestas sin rates", () => {
    expect(parseRatesResponse(null, ["USD"]).size).toBe(0);
    expect(parseRatesResponse({ error: "x" }, ["USD"]).size).toBe(0);
  });
});

describe("makeConverter", () => {
  it("convierte a la principal dividiendo entre la tasa", () => {
    const c = makeConverter("MXN", [{ quote: "USD", rate: 0.05, fetchedAt: now }]);
    expect(c.toBase(100, "MXN")).toBe(100);
    expect(c.toBase(10, "USD")).toBeCloseTo(200);
    expect(c.fetchedAt).toEqual(now);
    expect(c.missing.size).toBe(0);
  });

  it("deja fuera las monedas sin tasa y las anota", () => {
    const c = makeConverter("MXN", []);
    expect(c.toBase(10, "EUR")).toBe(0);
    expect([...c.missing]).toEqual(["EUR"]);
    expect(c.fetchedAt).toBeNull();
  });

  it("reporta la fecha de la tasa más antigua usada", () => {
    const older = new Date(now.getTime() - 1000);
    const c = makeConverter("MXN", [
      { quote: "USD", rate: 0.05, fetchedAt: now },
      { quote: "EUR", rate: 0.04, fetchedAt: older },
    ]);
    c.toBase(1, "USD");
    c.toBase(1, "EUR");
    expect(c.fetchedAt).toEqual(older);
  });
});

describe("crossRates", () => {
  it("calcula tasas entre dos monedas desde el pivote", () => {
    // 1 USD = 20 MXN = 0.9 EUR
    const perUsd = new Map([["USD", 1], ["MXN", 20], ["EUR", 0.9]]);
    const r = crossRates(perUsd, "MXN", ["USD", "EUR", "ARS"]);
    expect(r.get("USD")).toBeCloseTo(0.05);
    expect(r.get("EUR")).toBeCloseTo(0.045);
    expect(r.has("ARS")).toBe(false);
    expect(crossRates(perUsd, "ARS", ["USD"]).size).toBe(0);
  });
});

describe("parseTreasury", () => {
  it("usa el registro más reciente de cada moneda", () => {
    const perUsd = parseTreasury({
      data: [
        { country_currency_desc: "Mexico-Peso", exchange_rate: "19.5", record_date: "2026-06-30" },
        { country_currency_desc: "Mexico-Peso", exchange_rate: "18.2", record_date: "2026-09-30" },
        { country_currency_desc: "Argentina-Peso", exchange_rate: "x", record_date: "2026-09-30" },
      ],
    });
    expect(perUsd.get("USD")).toBe(1);
    expect(perUsd.get("MXN")).toBe(18.2);
    expect(perUsd.has("ARS")).toBe(false);
  });
});

describe("parseBanxico", () => {
  it("convierte pesos por unidad a unidades por peso", () => {
    const perMxn = parseBanxico({
      bmx: {
        series: [
          { idSerie: "SF43718", datos: [{ fecha: "15/10/2026", dato: "18.5000" }] },
          { idSerie: "SF46410", datos: [{ fecha: "15/10/2026", dato: "N/E" }] },
        ],
      },
    });
    expect(perMxn.get("MXN")).toBe(1);
    expect(perMxn.get("USD")).toBeCloseTo(1 / 18.5);
    expect(perMxn.has("EUR")).toBe(false);
  });
});

describe("manualCachedRates", () => {
  it("invierte las tasas manuales y descarta las de otra principal", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const rates = manualCachedRates("MXN", { base: "MXN", rates: { USD: 20 } }, at);
    expect(rates).toEqual([{ quote: "USD", rate: 0.05, fetchedAt: at }]);
    expect(makeConverter("MXN", rates).toBase(10, "USD")).toBeCloseTo(200);
    expect(manualCachedRates("USD", { base: "MXN", rates: { USD: 20 } }, at)).toEqual([]);
    expect(manualCachedRates("MXN", null, at)).toEqual([]);
  });
});

describe("isPrivateAddress", () => {
  it("detecta direcciones locales", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});

describe("buildCustomUrl", () => {
  it("reemplaza los marcadores o agrega base y symbols", () => {
    expect(buildCustomUrl("https://x.com/r/{base}?to={symbols}", "MXN", ["USD", "EUR"])).toBe(
      "https://x.com/r/MXN?to=USD,EUR"
    );
    expect(buildCustomUrl("https://x.com/latest", "MXN", ["USD"])).toBe(
      "https://x.com/latest?base=MXN&symbols=USD"
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  firstDueOnOrAfter,
  isDueInMonth,
  monthlyEquivalent,
  nextDueAfter,
} from "./subscription-schedule";

const monthly = (billingDay: number) => ({
  frequency: "MONTHLY" as const,
  billingDay,
  billingMonth: null,
});
const yearly = (billingMonth: number, billingDay: number) => ({
  frequency: "YEARLY" as const,
  billingDay,
  billingMonth,
});
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("firstDueOnOrAfter", () => {
  it("mensual: este mes si el día no ha pasado", () => {
    expect(firstDueOnOrAfter(monthly(22), new Date(2026, 9, 6, 20))).toEqual(day(2026, 10, 22));
  });

  it("mensual: el mismo día cuenta, aunque ya sea tarde", () => {
    expect(firstDueOnOrAfter(monthly(6), new Date(2026, 9, 6, 23))).toEqual(day(2026, 10, 6));
  });

  it("mensual: el mes siguiente si ya pasó", () => {
    expect(firstDueOnOrAfter(monthly(5), new Date(2026, 9, 6))).toEqual(day(2026, 11, 5));
  });

  it("el día 31 cae en el último día de meses cortos", () => {
    expect(firstDueOnOrAfter(monthly(31), new Date(2027, 1, 10))).toEqual(day(2027, 2, 28));
  });

  it("anual: este año o el siguiente según el mes", () => {
    expect(firstDueOnOrAfter(yearly(12, 1), new Date(2026, 9, 6))).toEqual(day(2026, 12, 1));
    expect(firstDueOnOrAfter(yearly(3, 9), new Date(2026, 9, 6))).toEqual(day(2027, 3, 9));
  });
});

describe("nextDueAfter", () => {
  it("mensual: el mes siguiente, también al cruzar el año", () => {
    expect(nextDueAfter(monthly(15), day(2026, 12, 15))).toEqual(day(2027, 1, 15));
  });

  it("mensual: después de un mes corto vuelve al día configurado", () => {
    expect(nextDueAfter(monthly(31), day(2027, 2, 28))).toEqual(day(2027, 3, 31));
  });

  it("anual: el año siguiente; el 29 de febrero cae en 28 si no es bisiesto", () => {
    expect(nextDueAfter(yearly(2, 29), day(2028, 2, 29))).toEqual(day(2029, 2, 28));
  });
});

describe("isDueInMonth", () => {
  it("las mensuales todos los meses, las anuales solo en su mes", () => {
    const oct = new Date(2026, 9, 6);
    expect(isDueInMonth(monthly(1), oct)).toBe(true);
    expect(isDueInMonth(yearly(10, 30), oct)).toBe(true);
    expect(isDueInMonth(yearly(3, 9), oct)).toBe(false);
  });
});

describe("monthlyEquivalent", () => {
  it("reparte las anuales en 12 meses", () => {
    expect(monthlyEquivalent({ ...yearly(3, 9), amount: 1200 })).toBe(100);
    expect(monthlyEquivalent({ ...monthly(9), amount: 199 })).toBe(199);
  });
});

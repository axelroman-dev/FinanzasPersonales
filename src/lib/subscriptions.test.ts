import { describe, expect, it } from "vitest";
import { monthRange, summarizeSubscriptions } from "./subscriptions";

describe("summarizeSubscriptions", () => {
  const monthly = { frequency: "MONTHLY" as const, billingDay: 1, billingMonth: null };
  const subs = [
    { id: "netflix", amount: 199, isActive: true, ...monthly },
    { id: "spotify", amount: 99, isActive: true, ...monthly },
    { id: "gym", amount: 500, isActive: false, ...monthly },
  ];

  it("sin pagos, todas las activas están pendientes", () => {
    expect(summarizeSubscriptions(subs, new Set())).toEqual({
      activeTotal: 298,
      paidTotal: 0,
      pendingTotal: 298,
    });
  });

  it("las pagadas este mes no cuentan como pendientes", () => {
    expect(summarizeSubscriptions(subs, new Set(["netflix"]))).toEqual({
      activeTotal: 298,
      paidTotal: 199,
      pendingTotal: 99,
    });
  });

  it("ignora las inactivas aunque tengan pago", () => {
    expect(summarizeSubscriptions(subs, new Set(["gym"])).activeTotal).toBe(298);
  });

  it("las anuales suman 1/12 al total y solo cuentan en su mes", () => {
    const amazon = {
      id: "amazon",
      amount: 1200,
      isActive: true,
      frequency: "YEARLY" as const,
      billingDay: 9,
      billingMonth: 3,
    };
    const march = new Date(2027, 2, 1);
    const october = new Date(2026, 9, 1);
    expect(summarizeSubscriptions([amazon], new Set(), october)).toEqual({
      activeTotal: 100,
      paidTotal: 0,
      pendingTotal: 0,
    });
    expect(summarizeSubscriptions([amazon], new Set(), march).pendingTotal).toBe(1200);
  });
});

describe("monthRange", () => {
  it("cubre del día 1 al último día del mes", () => {
    const { start, end } = monthRange(new Date(2026, 1, 15)); // febrero
    expect(start).toEqual(new Date(2026, 1, 1));
    expect(end.getDate()).toBe(28);
    expect(end.getMonth()).toBe(1);
  });
});

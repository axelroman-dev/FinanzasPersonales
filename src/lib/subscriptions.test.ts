import { describe, expect, it } from "vitest";
import { monthRange, summarizeSubscriptions } from "./subscriptions";

describe("summarizeSubscriptions", () => {
  const subs = [
    { id: "netflix", amount: 199, isActive: true },
    { id: "spotify", amount: 99, isActive: true },
    { id: "gym", amount: 500, isActive: false },
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
});

describe("monthRange", () => {
  it("cubre del día 1 al último día del mes", () => {
    const { start, end } = monthRange(new Date(2026, 1, 15)); // febrero
    expect(start).toEqual(new Date(2026, 1, 1));
    expect(end.getDate()).toBe(28);
    expect(end.getMonth()).toBe(1);
  });
});

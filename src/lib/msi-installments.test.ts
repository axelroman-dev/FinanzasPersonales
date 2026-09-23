import { describe, expect, it } from "vitest";
import { msiParentRevertAmount, splitInstallments } from "./msi-installments";

const sum = (xs: { toNumber(): number }[]) =>
  Math.round(xs.reduce((s, x) => s + x.toNumber(), 0) * 100) / 100;

describe("splitInstallments", () => {
  it("divide exacto cuando no hay centavos sobrantes", () => {
    expect(splitInstallments(1200, 12).map((x) => x.toNumber())).toEqual(Array(12).fill(100));
  });

  it("reparte los centavos sobrantes en las primeras mensualidades", () => {
    expect(splitInstallments(100, 3).map((x) => x.toNumber())).toEqual([33.34, 33.33, 33.33]);
  });

  it("la suma siempre es igual al total", () => {
    for (const [total, n] of [
      [100, 3],
      [999.99, 7],
      [0.05, 2],
      [15499.9, 18],
    ] as const) {
      expect(sum(splitInstallments(total, n))).toBe(total);
    }
  });

  it("todas las mensualidades tienen como máximo 2 decimales", () => {
    for (const x of splitInstallments(999.99, 7)) {
      expect(x.decimalPlaces()).toBeLessThanOrEqual(2);
    }
  });
});

describe("msiParentRevertAmount", () => {
  it("con todas las mensualidades, revierte el total de la compra", () => {
    expect(
      msiParentRevertAmount({
        totalAmount: 300,
        installments: 3,
        remainingChildren: [100, 100, 100],
      }).toNumber()
    ).toBe(300);
  });

  it("si ya se borró una mensualidad, solo revierte las que quedan", () => {
    // La mensualidad borrada ya redujo la deuda en 100
    expect(
      msiParentRevertAmount({
        totalAmount: 300,
        installments: 3,
        remainingChildren: [100, 100],
      }).toNumber()
    ).toBe(200);
  });

  it("si ya no queda ninguna mensualidad, no revierte nada", () => {
    expect(
      msiParentRevertAmount({ totalAmount: 300, installments: 3, remainingChildren: [] }).toNumber()
    ).toBe(0);
  });
});

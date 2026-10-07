import { describe, expect, it } from "vitest";
import { isCardPayment } from "./account-types";

describe("isCardPayment", () => {
  it("es pago de tarjeta de débito o ahorro a crédito", () => {
    expect(isCardPayment("DEBIT", "CREDIT")).toBe(true);
    expect(isCardPayment("SAVINGS", "CREDIT")).toBe(true);
  });

  it("no lo es entre tarjetas, hacia débito ni sin cuenta destino", () => {
    expect(isCardPayment("CREDIT", "CREDIT")).toBe(false);
    expect(isCardPayment("DEBIT", "SAVINGS")).toBe(false);
    expect(isCardPayment("DEBIT", null)).toBe(false);
  });
});

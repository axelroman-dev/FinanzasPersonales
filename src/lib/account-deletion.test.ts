import { describe, expect, it } from "vitest";
import type { AccountType } from "@prisma/client";
import { detachTransfer } from "./account-deletion";
import { balanceEffects } from "./transaction-balance";

const deleted = { id: "A", name: "Vieja" };
const types: Record<string, AccountType> = { A: "DEBIT", B: "CREDIT", X: "SAVINGS" };

/** Efecto en el balance de una cuenta concreta */
function effectOn(accountId: string, tx: Parameters<typeof balanceEffects>[0]) {
  return balanceEffects(tx)
    .filter((d) => d.accountId === accountId)
    .reduce((sum, d) => sum + d.delta.toNumber(), 0);
}

describe("detachTransfer", () => {
  it("A → B: pasa a ser un ingreso en B y el balance de B no cambia", () => {
    const tx = { accountId: "A", transferAccountId: "B", description: "Pago tarjeta" };
    const result = detachTransfer(tx, deleted);
    expect(result).toMatchObject({
      action: "update",
      data: { type: "INCOME", accountId: "B", transferAccountId: null },
    });
    if (result.action !== "update") return;
    expect(result.data.description).toContain('desde la cuenta eliminada "Vieja"');

    const before = effectOn("B", {
      type: "TRANSFER", amount: 500, accountId: "A", accountType: types.A,
      transferAccountId: "B", transferAccountType: types.B,
    });
    const after = effectOn("B", {
      type: result.data.type, amount: 500, accountId: "B", accountType: types.B,
    });
    expect(after).toBe(before);
  });

  it("X → A: pasa a ser un gasto en X y el balance de X no cambia", () => {
    const tx = { accountId: "X", transferAccountId: "A", description: "Ahorro" };
    const result = detachTransfer(tx, deleted);
    expect(result).toMatchObject({
      action: "update",
      data: { type: "EXPENSE", accountId: "X", transferAccountId: null },
    });
    if (result.action !== "update") return;
    expect(result.data.description).toContain("hacia la cuenta eliminada");

    const before = effectOn("X", {
      type: "TRANSFER", amount: 300, accountId: "X", accountType: types.X,
      transferAccountId: "A", transferAccountType: types.A,
    });
    const after = effectOn("X", {
      type: result.data.type, amount: 300, accountId: "X", accountType: types.X,
    });
    expect(after).toBe(before);
  });

  it("transferencia sin destino desde la cuenta eliminada: se borra", () => {
    expect(detachTransfer({ accountId: "A", transferAccountId: null, description: "x" }, deleted))
      .toEqual({ action: "delete" });
  });

  it("falla si la transferencia no involucra a la cuenta", () => {
    expect(() => detachTransfer({ accountId: "B", transferAccountId: "X", description: "x" }, deleted))
      .toThrow();
  });
});

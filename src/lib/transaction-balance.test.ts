import { describe, expect, it } from "vitest";
import {
  adjustmentMovement,
  balanceEffects,
  editEffects,
  revertEffects,
  type BalanceDelta,
  type BalanceTx,
} from "./transaction-balance";

/** Convierte los deltas a { cuenta: número } para comparar fácil */
function byAccount(deltas: BalanceDelta[]) {
  return Object.fromEntries(deltas.map((d) => [d.accountId, d.delta.toNumber()]));
}

const expense = (over: Partial<BalanceTx> = {}): BalanceTx => ({
  type: "EXPENSE",
  amount: 100,
  accountId: "debito",
  accountType: "DEBIT",
  ...over,
});

describe("balanceEffects", () => {
  it("un gasto en débito reduce el disponible", () => {
    expect(byAccount(balanceEffects(expense()))).toEqual({ debito: -100 });
  });

  it("un gasto en crédito incrementa la deuda", () => {
    expect(
      byAccount(balanceEffects(expense({ accountId: "tarjeta", accountType: "CREDIT" })))
    ).toEqual({ tarjeta: 100 });
  });

  it("un ingreso incrementa el balance", () => {
    expect(byAccount(balanceEffects(expense({ type: "INCOME" })))).toEqual({ debito: 100 });
  });

  it("una transferencia resta del origen y suma al destino", () => {
    expect(
      byAccount(
        balanceEffects(expense({ type: "TRANSFER", transferAccountId: "ahorro", transferAccountType: "SAVINGS" }))
      )
    ).toEqual({ debito: -100, ahorro: 100 });
  });

  it("un ingreso a la tarjeta (reembolso) reduce la deuda", () => {
    expect(
      byAccount(
        balanceEffects(expense({ type: "INCOME", accountId: "tarjeta", accountType: "CREDIT" }))
      )
    ).toEqual({ tarjeta: -100 });
  });

  it("pagar la tarjeta desde débito reduce el disponible y la deuda", () => {
    expect(
      byAccount(
        balanceEffects(
          expense({ type: "TRANSFER", transferAccountId: "tarjeta", transferAccountType: "CREDIT" })
        )
      )
    ).toEqual({ debito: -100, tarjeta: -100 });
  });

  it("sacar efectivo de la tarjeta aumenta la deuda y el disponible", () => {
    expect(
      byAccount(
        balanceEffects({
          type: "TRANSFER",
          amount: 100,
          accountId: "tarjeta",
          accountType: "CREDIT",
          transferAccountId: "debito",
          transferAccountType: "DEBIT",
        })
      )
    ).toEqual({ tarjeta: 100, debito: 100 });
  });

  it("una transferencia sin tipo de cuenta destino es un error", () => {
    expect(() =>
      balanceEffects(expense({ type: "TRANSFER", transferAccountId: "ahorro" }))
    ).toThrow();
  });

  it("una transferencia sin destino (datos legacy) no afecta nada", () => {
    expect(balanceEffects(expense({ type: "TRANSFER", transferAccountId: null }))).toEqual([]);
  });

  it("acepta montos como Decimal/string sin errores de punto flotante", () => {
    expect(balanceEffects(expense({ amount: "0.10" }))[0].delta.toString()).toBe("-0.1");
  });
});

describe("revertEffects", () => {
  it("es exactamente el inverso de balanceEffects", () => {
    const tx = expense({ type: "TRANSFER", transferAccountId: "ahorro", transferAccountType: "SAVINGS" });
    expect(byAccount(revertEffects(tx))).toEqual({ debito: 100, ahorro: -100 });
  });
});

describe("editEffects", () => {
  it("cambiar el monto de un gasto solo aplica la diferencia", () => {
    // Gasto de 100 editado a 150: la cuenta debe bajar 50 más
    expect(byAccount(editEffects(expense(), expense({ amount: 150 })))).toEqual({
      debito: -50,
    });
  });

  it("sin cambios de monto, tipo ni cuenta no toca ningún balance", () => {
    expect(editEffects(expense(), expense())).toEqual([]);
  });

  it("mover un gasto a otra cuenta lo devuelve al origen y lo cobra en la nueva", () => {
    expect(
      byAccount(
        editEffects(expense(), expense({ accountId: "tarjeta", accountType: "CREDIT" }))
      )
    ).toEqual({ debito: 100, tarjeta: 100 });
  });

  it("cambiar un gasto a ingreso revierte el gasto y suma el ingreso", () => {
    expect(byAccount(editEffects(expense(), expense({ type: "INCOME" })))).toEqual({
      debito: 200,
    });
  });

  it("cambiar el destino de una transferencia mueve el monto entre destinos", () => {
    const before = expense({ type: "TRANSFER", transferAccountId: "ahorro", transferAccountType: "SAVINGS" });
    const after = expense({ type: "TRANSFER", transferAccountId: "vales", transferAccountType: "VOUCHER" });
    expect(byAccount(editEffects(before, after))).toEqual({ ahorro: -100, vales: 100 });
  });

  it("editar y luego borrar deja la cuenta como si el movimiento nunca hubiera existido", () => {
    // Crear 100 -> editar a 150 -> borrar
    const created = expense();
    const edited = expense({ amount: 150 });
    const total = [
      ...balanceEffects(created),
      ...editEffects(created, edited),
      ...revertEffects(edited),
    ].reduce((sum, d) => sum + d.delta.toNumber(), 0);
    expect(total).toBe(0);
  });
});

describe("adjustmentMovement", () => {
  const apply = (accountType: BalanceTx["accountType"], from: number, to: number) => {
    const movement = adjustmentMovement(accountType, from, to);
    if (!movement) return from;
    const [effect] = balanceEffects({ ...movement, accountId: "cuenta", accountType });
    return effect.delta.add(from).toNumber();
  };

  it("sin cambio no genera movimiento", () => {
    expect(adjustmentMovement("DEBIT", 500, 500)).toBeNull();
  });

  it("subir el balance de débito es un ingreso", () => {
    const movement = adjustmentMovement("DEBIT", 0, 1500);
    expect(movement?.type).toBe("INCOME");
    expect(movement?.amount.toNumber()).toBe(1500);
  });

  it("subir la deuda de una tarjeta es un gasto", () => {
    const movement = adjustmentMovement("CREDIT", 1000, 1200);
    expect(movement?.type).toBe("EXPENSE");
    expect(movement?.amount.toNumber()).toBe(200);
  });

  it.each([
    ["DEBIT", 0, 1500],
    ["DEBIT", 800, 300],
    ["SAVINGS", 0, -50],
    ["CREDIT", 0, 4000],
    ["CREDIT", 4000, 3500.5],
  ] as const)("en %s lleva el balance de %d a %d", (type, from, to) => {
    expect(apply(type, from, to)).toBe(to);
  });
});

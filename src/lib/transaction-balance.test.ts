import { describe, expect, it } from "vitest";
import {
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

describe("regla anterior (balanceRule 1)", () => {
  const payCard = (balanceRule: number) =>
    expense({
      type: "TRANSFER",
      transferAccountId: "tarjeta",
      transferAccountType: "CREDIT",
      balanceRule,
    });

  it("pagar la tarjeta aumentaba la deuda", () => {
    expect(byAccount(balanceEffects(payCard(1)))).toEqual({ debito: -100, tarjeta: 100 });
  });

  it("los gastos en tarjeta son iguales con ambas reglas", () => {
    const gasto = (balanceRule: number) =>
      expense({ accountId: "tarjeta", accountType: "CREDIT", balanceRule });
    expect(byAccount(balanceEffects(gasto(1)))).toEqual(byAccount(balanceEffects(gasto(2))));
  });

  it("borrar un pago viejo lo revierte con la regla con la que se aplicó", () => {
    expect(byAccount(revertEffects(payCard(1)))).toEqual({ debito: 100, tarjeta: -100 });
  });

  it("editar un pago viejo sin cambios lo migra a la regla actual", () => {
    // La deuda baja 200: se quita el +100 equivocado y se aplica el -100 correcto
    expect(byAccount(editEffects(payCard(1), payCard(2)))).toEqual({ tarjeta: -200 });
  });
});

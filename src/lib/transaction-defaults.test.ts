import { describe, expect, it } from "vitest";
import { newTransactionDefaults } from "./transaction-defaults";

const categories = [
  {
    id: "comida",
    kind: "EXPENSE" as const,
    children: [{ id: "super", kind: "EXPENSE" as const, children: [] }],
  },
  {
    id: "salario",
    kind: "INCOME" as const,
    children: [{ id: "nomina", kind: "INCOME" as const, children: [] }],
  },
  {
    id: "ajustes",
    kind: "INTERNAL" as const,
    children: [{ id: "inicial", kind: "INTERNAL" as const, children: [] }],
  },
];
const accounts = ["debito", "tarjeta"];

describe("newTransactionDefaults", () => {
  it("sin filtros no fija nada", () => {
    expect(newTransactionDefaults({}, accounts, categories)).toEqual({});
  });

  it("usa la cuenta y el tipo del filtro", () => {
    expect(
      newTransactionDefaults({ accountId: "tarjeta", type: "TRANSFER" }, accounts, categories)
    ).toEqual({ accountId: "tarjeta", type: "TRANSFER" });
  });

  it("ignora una cuenta o un tipo que no existen", () => {
    expect(
      newTransactionDefaults({ accountId: "otra", type: "FOO" }, accounts, categories)
    ).toEqual({});
  });

  it("una subcategoría fija la categoría y su tipo", () => {
    expect(newTransactionDefaults({ categoryId: "nomina" }, accounts, categories)).toEqual({
      type: "INCOME",
      categoryId: "nomina",
    });
  });

  it("una principal fija solo el tipo", () => {
    expect(newTransactionDefaults({ categoryId: "comida" }, accounts, categories)).toEqual({
      type: "EXPENSE",
    });
  });

  it("si el tipo del filtro contradice la categoría, se queda el tipo", () => {
    expect(
      newTransactionDefaults({ type: "INCOME", categoryId: "super" }, accounts, categories)
    ).toEqual({ type: "INCOME" });
  });

  it("ignora las categorías internas", () => {
    expect(newTransactionDefaults({ categoryId: "inicial" }, accounts, categories)).toEqual({});
  });

  it("el filtro de MSI marca el movimiento como MSI", () => {
    expect(newTransactionDefaults({ msi: "true" }, accounts, categories)).toEqual({
      isMsi: true,
    });
  });
});

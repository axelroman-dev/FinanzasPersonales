import { describe, expect, it } from "vitest";
import { suggestDescriptions } from "./description-suggestions";

// Ordenadas de la más usada a la menos
const known = ["Oxxo", "Café Punta del Cielo", "Uber al trabajo", "Gasolina", "Starbucks café"];

describe("suggestDescriptions", () => {
  it("sin texto no sugiere nada", () => {
    expect(suggestDescriptions(known, "  ")).toEqual([]);
  });

  it("ignora acentos y mayúsculas; primero las que empiezan con el texto", () => {
    expect(suggestDescriptions(known, "CAFE")).toEqual(["Café Punta del Cielo", "Starbucks café"]);
  });

  it("no repite el texto que ya está escrito", () => {
    expect(suggestDescriptions(known, "oxxo")).toEqual([]);
  });

  it("respeta el límite y el orden de uso", () => {
    expect(suggestDescriptions(known, "a", 2)).toEqual(["Café Punta del Cielo", "Uber al trabajo"]);
  });
});

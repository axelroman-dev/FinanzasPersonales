import { describe, expect, it } from "vitest";
import { generateSetupCode, hashSetupCode, setupCodeMatches } from "./setup-code";

describe("generateSetupCode", () => {
  it("tiene el formato XXXX-XXXX", () => {
    expect(generateSetupCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("no usa caracteres ambiguos (0, O, 1, I)", () => {
    const codes = Array.from({ length: 200 }, generateSetupCode).join("");
    expect(codes).not.toMatch(/[0O1I]/);
  });

  it("genera códigos distintos cada vez", () => {
    const codes = new Set(Array.from({ length: 100 }, generateSetupCode));
    expect(codes.size).toBe(100);
  });
});

describe("setupCodeMatches", () => {
  const code = "K7QM-3XPD";
  const stored = hashSetupCode(code);

  it("acepta el código exacto", () => {
    expect(setupCodeMatches(code, stored)).toBe(true);
  });

  it("acepta minúsculas, sin guion o con espacios", () => {
    for (const input of ["k7qm-3xpd", "K7QM3XPD", " k7qm 3xpd "]) {
      expect(setupCodeMatches(input, stored)).toBe(true);
    }
  });

  it("rechaza un código distinto", () => {
    expect(setupCodeMatches("K7QM-3XPE", stored)).toBe(false);
  });

  it("no guarda el código en claro", () => {
    expect(stored).not.toContain("K7QM");
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});

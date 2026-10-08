import { describe, expect, it } from "vitest";
import { codeMatches, generateCode, hashCode, normalizeEmail } from "./registration";

describe("códigos de verificación", () => {
  it("son de 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("la huella depende del correo y del código", () => {
    const h = hashCode("ana@x.mx", "123456");
    expect(codeMatches(h, "ana@x.mx", "123456")).toBe(true);
    expect(codeMatches(h, "ana@x.mx", "123457")).toBe(false);
    expect(codeMatches(h, "otro@x.mx", "123456")).toBe(false);
    expect(h).not.toContain("123456");
  });

  it("el correo se guarda en minúsculas y sin espacios", () => {
    expect(normalizeEmail("  Ana@X.MX ")).toBe("ana@x.mx");
  });
});

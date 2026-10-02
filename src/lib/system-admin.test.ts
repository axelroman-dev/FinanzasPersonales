import { describe, expect, it } from "vitest";
import { getAdminPassword, isSystemAdmin } from "./system-admin";

describe("getAdminPassword", () => {
  it("falla si falta", () => {
    expect(() => getAdminPassword({})).toThrow(/ADMIN_PASSWORD/);
    expect(() => getAdminPassword({ ADMIN_PASSWORD: "" })).toThrow(/ADMIN_PASSWORD/);
  });

  it("falla si es demasiado corta", () => {
    expect(() => getAdminPassword({ ADMIN_PASSWORD: "corta" })).toThrow(/12/);
  });

  it("devuelve la contraseña válida", () => {
    expect(getAdminPassword({ ADMIN_PASSWORD: "una-contraseña-larga" })).toBe(
      "una-contraseña-larga"
    );
  });
});

describe("isSystemAdmin", () => {
  it("compara el email sin importar mayúsculas", () => {
    expect(isSystemAdmin({ email: "Admin@Finanzas.local" })).toBe(true);
    expect(isSystemAdmin({ email: "otro@finanzas.local" })).toBe(false);
  });
});

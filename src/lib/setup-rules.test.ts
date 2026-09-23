import { describe, expect, it } from "vitest";
import { normalizeSetupCode, setupSchema } from "./setup-rules";

const valid = {
  code: "K7QM-3XPD",
  name: "Admin",
  email: "Admin@Ejemplo.com ",
  password: "una-contraseña-larga",
  allowRegistration: false,
};

describe("normalizeSetupCode", () => {
  it("pasa a mayúsculas y quita separadores", () => {
    expect(normalizeSetupCode(" k7qm-3xpd ")).toBe("K7QM3XPD");
  });
});

describe("setupSchema", () => {
  it("acepta datos válidos y normaliza el email", () => {
    const parsed = setupSchema.parse(valid);
    expect(parsed.email).toBe("admin@ejemplo.com");
  });

  it("rechaza contraseñas de menos de 12 caracteres", () => {
    expect(setupSchema.safeParse({ ...valid, password: "corta12345" }).success).toBe(false);
  });

  it("rechaza un email inválido", () => {
    expect(setupSchema.safeParse({ ...valid, email: "no-es-email" }).success).toBe(false);
  });

  it("exige decidir explícitamente si se permite el registro", () => {
    const { allowRegistration: _, ...sinRegistro } = valid;
    expect(setupSchema.safeParse(sinRegistro).success).toBe(false);
  });
});

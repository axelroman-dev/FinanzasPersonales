import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./auth-tokens";

describe("tokens de enlace", () => {
  it("genera tokens distintos, aptos para URL", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("el hash es estable y no es el token", () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

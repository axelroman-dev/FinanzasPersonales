import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("permite hasta el límite dentro de la ventana", () => {
    const rl = createRateLimiter(2, 1000);
    expect(rl.take("ip", 0)).toBe(true);
    expect(rl.take("ip", 100)).toBe(true);
    expect(rl.take("ip", 200)).toBe(false);
  });

  it("vuelve a permitir cuando pasa la ventana, y cada clave va aparte", () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("b", 0)).toBe(true);
    expect(rl.take("a", 500)).toBe(false);
    expect(rl.take("a", 1000)).toBe(true);
  });
});

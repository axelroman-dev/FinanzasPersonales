import { describe, expect, it } from "vitest";
import { toDateTimeLocalValue } from "./utils";

describe("toDateTimeLocalValue", () => {
  it("usa la hora local, no UTC", () => {
    const d = new Date(2026, 9, 2, 21, 5); // 2 oct 2026, 21:05 hora local
    expect(toDateTimeLocalValue(d)).toBe("2026-10-02T21:05");
  });

  it("ida y vuelta con new Date() conserva el instante (sin segundos)", () => {
    const d = new Date(2026, 0, 31, 7, 9);
    expect(new Date(toDateTimeLocalValue(d)).getTime()).toBe(d.getTime());
  });
});

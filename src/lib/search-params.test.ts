import { describe, expect, it } from "vitest";
import { dateParam, enumParam, firstParam } from "./search-params";

describe("firstParam", () => {
  it("devuelve el valor o el primero si se repite", () => {
    expect(firstParam("a")).toBe("a");
    expect(firstParam(["a", "b"])).toBe("a");
  });

  it("vacío o ausente es undefined", () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam("")).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});

describe("dateParam", () => {
  it("acepta YYYY-MM-DD válidas", () => {
    expect(dateParam("2026-10-24")).toBe("2026-10-24");
    expect(dateParam("2024-02-29")).toBe("2024-02-29");
  });

  it("rechaza formatos y fechas que no existen", () => {
    for (const v of ["abc", "2026-1-5", "24/10/2026", "2026-02-31", "2025-02-29", "2026-13-01", "2026-10-24T10:00"]) {
      expect(dateParam(v)).toBeUndefined();
    }
  });
});

describe("enumParam", () => {
  const types = ["INCOME", "EXPENSE"] as const;

  it("solo acepta valores de la lista", () => {
    expect(enumParam("EXPENSE", types)).toBe("EXPENSE");
    expect(enumParam("expense", types)).toBeUndefined();
    expect(enumParam("foo", types)).toBeUndefined();
    expect(enumParam(["foo", "INCOME"], types)).toBeUndefined();
  });
});

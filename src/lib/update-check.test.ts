import { describe, expect, it } from "vitest";
import { isNewer, latestVersionFromTags, parseVersion } from "./update-check";

describe("parseVersion", () => {
  it("acepta X.Y.Z con o sin v", () => {
    expect(parseVersion("0.18.0")).toEqual([0, 18, 0]);
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
  });

  it("rechaza tags que no son versión completa", () => {
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("0.18")).toBeNull();
    expect(parseVersion("1.0.0-rc.1")).toBeNull();
  });
});

describe("latestVersionFromTags", () => {
  it("elige la versión más alta, no la última subida", () => {
    const json = {
      results: [
        { name: "latest" },
        { name: "0.18" },
        { name: "0.9.0" },
        { name: "0.18.0" },
        { name: "0.17.4" },
      ],
    };
    expect(latestVersionFromTags(json)).toBe("0.18.0");
  });

  it("null si la respuesta no trae versiones", () => {
    expect(latestVersionFromTags({ results: [{ name: "latest" }] })).toBeNull();
    expect(latestVersionFromTags(null)).toBeNull();
  });
});

describe("isNewer", () => {
  it("compara numéricamente", () => {
    expect(isNewer("0.18.0", "0.9.5")).toBe(true);
    expect(isNewer("0.18.1", "0.18.0")).toBe(true);
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
  });

  it("false si está al día o adelantado", () => {
    expect(isNewer("0.18.0", "0.18.0")).toBe(false);
    expect(isNewer("0.17.4", "0.18.0")).toBe(false);
  });
});

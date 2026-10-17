import { afterEach, describe, expect, it } from "vitest";
import { defaultRateProvider, serverBanxicoToken } from "./onboarding";

describe("defaultRateProvider", () => {
  const original = process.env.BANXICO_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.BANXICO_TOKEN;
    else process.env.BANXICO_TOKEN = original;
  });

  it("sin BANXICO_TOKEN sugiere el Banco Central Europeo", () => {
    delete process.env.BANXICO_TOKEN;
    expect(serverBanxicoToken()).toBe(false);
    expect(defaultRateProvider()).toBe("ECB");
  });

  it("con BANXICO_TOKEN sugiere Banco de México (un valor en blanco no cuenta)", () => {
    process.env.BANXICO_TOKEN = "   ";
    expect(defaultRateProvider()).toBe("ECB");
    process.env.BANXICO_TOKEN = "abc123";
    expect(defaultRateProvider()).toBe("BANXICO");
  });
});

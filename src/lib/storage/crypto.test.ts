import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, getAttachmentsKey } from "./crypto";

const key = randomBytes(32);
const data = Buffer.from("recibo de prueba");

describe("cifrado de adjuntos", () => {
  it("ida y vuelta devuelve el mismo contenido", () => {
    const stored = encrypt(key, "u1/a", data);
    expect(stored.includes(data)).toBe(false);
    expect(decrypt(key, "u1/a", stored)).toEqual(data);
  });

  it("cada cifrado usa un IV distinto", () => {
    expect(encrypt(key, "u1/a", data)).not.toEqual(encrypt(key, "u1/a", data));
  });

  it("falla si el archivo fue alterado", () => {
    const stored = encrypt(key, "u1/a", data);
    stored[stored.length - 1] ^= 1;
    expect(() => decrypt(key, "u1/a", stored)).toThrow();
  });

  it("falla si se hace pasar por otra key (AAD)", () => {
    expect(() => decrypt(key, "u1/b", encrypt(key, "u1/a", data))).toThrow();
  });

  it("falla con otra clave", () => {
    expect(() => decrypt(randomBytes(32), "u1/a", encrypt(key, "u1/a", data))).toThrow();
  });
});

describe("getAttachmentsKey", () => {
  it("null si no está configurada", () => {
    expect(getAttachmentsKey({})).toBeNull();
    expect(getAttachmentsKey({ ATTACHMENTS_KEY: "  " })).toBeNull();
  });

  it("rechaza una clave que no es de 32 bytes", () => {
    expect(() => getAttachmentsKey({ ATTACHMENTS_KEY: "corta" })).toThrow(/32 bytes/);
  });

  it("acepta 32 bytes en base64", () => {
    const raw = randomBytes(32).toString("base64");
    expect(getAttachmentsKey({ ATTACHMENTS_KEY: raw })).toEqual(Buffer.from(raw, "base64"));
  });
});

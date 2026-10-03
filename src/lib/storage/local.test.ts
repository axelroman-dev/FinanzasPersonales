import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorage } from "./local";
import { newStorageKey } from "./keys";

const dir = mkdtempSync(path.join(tmpdir(), "adjuntos-"));
const storage = new LocalStorage(dir);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("LocalStorage", () => {
  it("guarda, lee, lista y borra", async () => {
    const key = newStorageKey("user1");
    await storage.put(key, Buffer.from("hola"));
    expect(await storage.get(key)).toEqual(Buffer.from("hola"));
    expect(await storage.list()).toContain(key);
    await storage.delete(key);
    await storage.delete(key); // no falla si ya no existe
    expect(await storage.list()).not.toContain(key);
  });

  it("no deja temporales al escribir", async () => {
    const key = newStorageKey("user2");
    await storage.put(key, Buffer.from("x"));
    expect(readdirSync(path.join(dir, "user2")).every((f) => f.endsWith(".bin"))).toBe(true);
  });

  it("rechaza keys que salen de la carpeta o mal formadas", async () => {
    await expect(storage.get("../etc/passwd")).rejects.toThrow(/inválida/);
    await expect(storage.get("user1/../../x")).rejects.toThrow(/inválida/);
    await expect(storage.deletePrefix("..")).rejects.toThrow(/inválido/);
    expect(() => newStorageKey("../x")).toThrow();
  });

  it("deletePrefix borra solo los archivos de ese usuario", async () => {
    const a = newStorageKey("usera");
    const b = newStorageKey("userb");
    await storage.put(a, Buffer.from("a"));
    await storage.put(b, Buffer.from("b"));
    await storage.deletePrefix("usera");
    const keys = await storage.list();
    expect(keys).not.toContain(a);
    expect(keys).toContain(b);
  });
});

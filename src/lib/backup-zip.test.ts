import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import { backupZipStream } from "./backup-zip";
import { attachmentPath, DATA_FILE, readBackup } from "./backup-file";
import { encrypt } from "./storage/crypto";
import { getStorage } from "./storage/storage";

const key = randomBytes(32);

beforeAll(async () => {
  process.env.ATTACHMENTS_DIR = await mkdtemp(path.join(tmpdir(), "backup-zip-"));
  process.env.ATTACHMENTS_KEY = key.toString("base64");
});

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("backupZipStream", () => {
  it("mete los adjuntos descifrados y los datos, y se puede volver a leer", async () => {
    const storageKey = "user1/00000000-0000-4000-8000-000000000001";
    const pdf = Buffer.from("%PDF-1.7\nrecibo");
    await getStorage().put(storageKey, encrypt(key, storageKey, pdf));
    const file = attachmentPath("att1", "application/pdf");

    const zip = await streamToBytes(
      backupZipStream([{ path: file, storageKey }], () => ({ version: "1.1" }))
    );
    const { json, files } = readBackup(zip);

    expect(json).toEqual({ version: "1.1" });
    expect(Buffer.from(files.get(file)!)).toEqual(pdf);
  });

  it("avisa de los adjuntos que no se pudieron leer, sin cortar el export", async () => {
    const missingKey = "user1/00000000-0000-4000-8000-000000000002";
    const zip = await streamToBytes(
      backupZipStream(
        [{ path: "adjuntos/falta.jpg", storageKey: missingKey }],
        (missing) => ({ missing: [...missing] })
      )
    );
    const { json, files } = readBackup(zip);
    expect(json).toEqual({ missing: ["adjuntos/falta.jpg"] });
    expect(files.size).toBe(0);
  });
});

describe("readBackup", () => {
  it("sigue leyendo los respaldos .json anteriores", () => {
    const { json, files } = readBackup(strToU8(JSON.stringify({ version: "1.0" })));
    expect(json).toEqual({ version: "1.0" });
    expect(files.size).toBe(0);
  });

  it("sin withFiles solo extrae los datos, e ignora lo que no son adjuntos", () => {
    const zip = zipSync({
      [DATA_FILE]: strToU8("{}"),
      "adjuntos/a.jpg": new Uint8Array([1, 2, 3]),
      "otro/b.txt": strToU8("x"),
    });
    expect(readBackup(zip, { withFiles: false }).files.size).toBe(0);
    expect([...readBackup(zip).files.keys()]).toEqual(["adjuntos/a.jpg"]);
  });

  it("rechaza un zip sin datos", () => {
    expect(() => readBackup(zipSync({ "adjuntos/a.jpg": new Uint8Array([1]) }))).toThrow();
  });
});

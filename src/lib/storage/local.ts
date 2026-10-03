import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { STORAGE_KEY_RE, USER_ID_RE } from "./keys";
import type { Storage } from "./storage";

/**
 * Adjuntos en disco: <dir>/<userId>/<uuid>.bin. Por defecto <cwd>/data/uploads
 * (en Docker, /app/data/uploads, montado como volumen).
 */
export class LocalStorage implements Storage {
  private readonly root: string;

  constructor(dir?: string) {
    this.root = path.resolve(dir || path.join(process.cwd(), "data", "uploads"));
  }

  /** Ruta del archivo; rechaza keys mal formadas o que salgan de la carpeta */
  private pathFor(key: string): string {
    if (!STORAGE_KEY_RE.test(key)) throw new Error(`Key de adjunto inválida: ${key}`);
    const file = path.resolve(this.root, `${key}.bin`);
    if (!file.startsWith(this.root + path.sep)) throw new Error("Ruta fuera de la carpeta de adjuntos");
    return file;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    // Escribir a un temporal y renombrar: nunca queda un archivo a medias
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, data, { mode: 0o600 });
    await rename(tmp, file);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async deletePrefix(userId: string): Promise<void> {
    if (!USER_ID_RE.test(userId)) throw new Error(`Usuario inválido: ${userId}`);
    await rm(path.join(this.root, userId), { recursive: true, force: true });
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    let users: string[];
    try {
      users = await readdir(this.root);
    } catch {
      return keys; // la carpeta aún no existe
    }
    for (const user of users) {
      if (!USER_ID_RE.test(user)) continue;
      for (const file of await readdir(path.join(this.root, user))) {
        const key = `${user}/${file.replace(/\.bin$/, "")}`;
        if (file.endsWith(".bin") && STORAGE_KEY_RE.test(key)) keys.push(key);
      }
    }
    return keys;
  }
}

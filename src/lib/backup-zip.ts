import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { decrypt, getAttachmentsKey } from "@/lib/storage/crypto";
import { getStorage } from "@/lib/storage/storage";
import { DATA_FILE } from "@/lib/backup-file";
import type { BackupFile } from "@/lib/export-import";

/**
 * Genera el zip del respaldo como stream, para no armarlo entero en memoria.
 * Los adjuntos van primero y sin comprimir (JPEG y PDF ya lo están); los datos
 * al final, para quitar de ellos los adjuntos que no se pudieron leer.
 */
export function backupZipStream(
  files: BackupFile[],
  /** Recibe las rutas que faltaron y devuelve el JSON final */
  buildJson: (missing: Set<string>) => unknown
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      const key = getAttachmentsKey();
      const storage = getStorage();
      const missing = new Set<string>();
      for (const file of files) {
        let data: Buffer;
        try {
          data = decrypt(key!, file.storageKey, await storage.get(file.storageKey));
        } catch (error) {
          console.error(`No se pudo exportar el adjunto ${file.storageKey}:`, error);
          missing.add(file.path);
          continue;
        }
        const entry = new ZipPassThrough(file.path);
        zip.add(entry);
        entry.push(data, true);
      }

      const json = new ZipDeflate(DATA_FILE, { level: 6 });
      zip.add(json);
      json.push(strToU8(JSON.stringify(buildJson(missing), null, 2)), true);
      zip.end();
    },
  });
}

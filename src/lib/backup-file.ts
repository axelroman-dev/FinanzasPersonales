import { strFromU8, unzipSync } from "fflate";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-rules";

/**
 * Archivo de respaldo: un .zip con los datos en DATA_FILE y los adjuntos
 * (descifrados) en ATTACHMENTS_DIR. Los respaldos anteriores eran un .json
 * suelto y se siguen pudiendo importar. Este módulo se usa también en el
 * navegador (para el preview), así que no importa nada de Node.
 */
export const DATA_FILE = "datos.json";
export const ATTACHMENTS_DIR = "adjuntos/";

/** Ruta dentro del zip de un adjunto */
export function attachmentPath(id: string, mimeType: string): string {
  return `${ATTACHMENTS_DIR}${id}.${mimeType === "application/pdf" ? "pdf" : "jpg"}`;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Lee un respaldo (.zip o .json). Con withFiles: false solo descomprime los
 * datos, sin los adjuntos. Lanza un error si el archivo no es válido.
 */
export function readBackup(
  bytes: Uint8Array,
  { withFiles = true }: { withFiles?: boolean } = {}
): { json: unknown; files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  if (!isZip(bytes)) return { json: JSON.parse(strFromU8(bytes)), files };

  const entries = unzipSync(bytes, {
    filter: (f) =>
      f.name === DATA_FILE ||
      (withFiles &&
        f.name.startsWith(ATTACHMENTS_DIR) &&
        f.originalSize <= MAX_ATTACHMENT_BYTES),
  });
  const data = entries[DATA_FILE];
  if (!data) throw new Error(`El zip no contiene ${DATA_FILE}`);
  for (const [name, content] of Object.entries(entries)) {
    if (name !== DATA_FILE) files.set(name, content);
  }
  return { json: JSON.parse(strFromU8(data)), files };
}

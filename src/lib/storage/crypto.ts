import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de adjuntos con AES-256-GCM. Formato del archivo en disco:
 *   versión (1 byte) | iv (12) | tag (16) | datos cifrados
 * La key de almacenamiento va como AAD: un archivo cifrado no se puede hacer
 * pasar por otro aunque se renombre en disco.
 */

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

/**
 * Lee ATTACHMENTS_KEY (32 bytes en base64). null si no está configurada: los
 * adjuntos quedan desactivados. Lanza un error si está pero es inválida.
 */
export function getAttachmentsKey(
  env: Record<string, string | undefined> = process.env
): Buffer | null {
  const raw = env.ATTACHMENTS_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ATTACHMENTS_KEY debe ser de 32 bytes en base64. Genérala con: openssl rand -base64 32"
    );
  }
  return key;
}

/** Si los adjuntos están activos (hay una ATTACHMENTS_KEY válida) */
export function attachmentsEnabled(): boolean {
  try {
    return getAttachmentsKey() !== null;
  } catch {
    return false;
  }
}

export function encrypt(key: Buffer, aad: string, plain: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), data]);
}

/** Lanza un error si el archivo fue alterado, la AAD no coincide o la clave es otra */
export function decrypt(key: Buffer, aad: string, stored: Buffer): Buffer {
  if (stored.length < HEADER_BYTES || stored[0] !== VERSION) {
    throw new Error("Formato de adjunto no reconocido");
  }
  const iv = stored.subarray(1, 1 + IV_BYTES);
  const tag = stored.subarray(1 + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(HEADER_BYTES)), decipher.final()]);
}

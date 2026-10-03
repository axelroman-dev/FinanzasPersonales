import sharp from "sharp";
import { prisma } from "@/lib/db";
import { decrypt, encrypt, getAttachmentsKey } from "@/lib/storage/crypto";
import { newStorageKey } from "@/lib/storage/keys";
import { getStorage } from "@/lib/storage/storage";
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
} from "@/lib/attachment-rules";

/**
 * Adjuntos de movimientos (fotos y PDF de recibos). Antes de guardarlos:
 * - el tipo se detecta por el contenido, no por la extensión ni el navegador
 * - las imágenes se recodifican sin metadatos (EXIF, GPS) y a tamaño acotado
 * - todo se cifra con ATTACHMENTS_KEY (ver src/lib/storage/crypto.ts)
 */

export class AttachmentError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 413 | 415 | 503 = 400
  ) {
    super(message);
  }
}

/** Clave de cifrado; sin ella los adjuntos están desactivados */
export function attachmentsKey(): Buffer {
  const key = getAttachmentsKey();
  if (!key) {
    throw new AttachmentError(
      "Los adjuntos no están configurados (falta ATTACHMENTS_KEY)",
      503
    );
  }
  return key;
}

type DetectedType = "jpeg" | "png" | "webp" | "pdf" | "heic";

/** Tipo real por los primeros bytes del archivo (magic bytes) */
export function detectType(buf: Buffer): DetectedType | null {
  const ascii = (start: number, end: number) => buf.subarray(start, end).toString("latin1");
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (buf.length >= 5 && ascii(0, 5) === "%PDF-") return "pdf";
  // HEIC/HEIF: caja "ftyp" con una marca de HEVC
  if (buf.length >= 12 && ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(8, 12))) {
    return "heic";
  }
  return null;
}

/** Nombre para mostrar: sin rutas ni caracteres de control, y con la extensión real */
export function sanitizeName(name: string, mimeType: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f"]/g, "")
    .trim();
  const stem = base.replace(/\.[^.]*$/, "").slice(0, 90) || "recibo";
  const ext = mimeType === "application/pdf" ? "pdf" : "jpg";
  return `${stem}.${ext}`;
}

/** Valida el archivo y lo deja listo para guardar */
export async function processUpload(
  input: Buffer
): Promise<{ data: Buffer; mimeType: string }> {
  if (input.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentError("El archivo pasa de 10 MB", 413);
  }
  const type = detectType(input);
  if (type === "heic") {
    throw new AttachmentError(
      "Las fotos HEIC no se pueden procesar. Súbela como JPEG: en iPhone, Ajustes › Cámara › Formatos › Más compatible",
      415
    );
  }
  if (!type) throw new AttachmentError("Solo se aceptan imágenes (JPEG, PNG, WebP) y PDF", 415);
  if (type === "pdf") return { data: input, mimeType: "application/pdf" };

  // Imagen: rotar según EXIF y recodificar. sharp no copia metadatos a la
  // salida salvo que se pida, así que el EXIF (y el GPS) se pierden
  try {
    const data = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return { data, mimeType: "image/jpeg" };
  } catch {
    throw new AttachmentError("La imagen está dañada o no se puede leer", 415);
  }
}

/**
 * Guarda los archivos de un movimiento del usuario. Si algo falla con uno, los
 * que ya se guardaron de esta subida se quedan; el que falló no deja rastro.
 */
export async function saveAttachments(params: {
  userId: string;
  transactionId: string;
  files: { name: string; data: Buffer }[];
}) {
  const { userId, transactionId, files } = params;
  const key = attachmentsKey();

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, categoryRef: { select: { kind: true } }, _count: { select: { attachments: true } } },
  });
  if (!transaction) throw new AttachmentError("Movimiento no encontrado", 404);
  if (transaction.categoryRef?.kind === "INTERNAL") {
    throw new AttachmentError("Los ajustes de cuenta no admiten adjuntos");
  }
  if (transaction._count.attachments + files.length > MAX_ATTACHMENTS_PER_TRANSACTION) {
    throw new AttachmentError(
      `Un movimiento admite hasta ${MAX_ATTACHMENTS_PER_TRANSACTION} adjuntos`
    );
  }

  // Procesar todo antes de guardar: si un archivo no es válido no se guarda ninguno
  const processed = await Promise.all(
    files.map(async (f) => ({ name: f.name, ...(await processUpload(f.data)) }))
  );

  const storage = getStorage();
  const saved = [];
  for (const file of processed) {
    const storageKey = newStorageKey(userId);
    await storage.put(storageKey, encrypt(key, storageKey, file.data));
    try {
      saved.push(
        await prisma.attachment.create({
          data: {
            userId,
            transactionId,
            originalName: sanitizeName(file.name, file.mimeType),
            mimeType: file.mimeType,
            size: file.data.length,
            storageKey,
          },
          select: ATTACHMENT_SELECT,
        })
      );
    } catch (error) {
      await storage.delete(storageKey);
      throw error;
    }
  }
  return saved;
}

export const ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

/** Adjunto del usuario con su contenido descifrado; 404 si no es suyo */
export async function readAttachment(userId: string, id: string) {
  const attachment = await prisma.attachment.findFirst({ where: { id, userId } });
  if (!attachment || !ATTACHMENT_MIME_TYPES.includes(attachment.mimeType)) {
    throw new AttachmentError("Adjunto no encontrado", 404);
  }
  const stored = await getStorage().get(attachment.storageKey);
  return {
    attachment,
    data: decrypt(attachmentsKey(), attachment.storageKey, stored),
  };
}

export async function deleteAttachment(userId: string, id: string): Promise<void> {
  const attachment = await prisma.attachment.findFirst({ where: { id, userId } });
  if (!attachment) throw new AttachmentError("Adjunto no encontrado", 404);
  await prisma.attachment.delete({ where: { id } });
  await deleteStoredFiles([attachment.storageKey]);
}

/**
 * Borra archivos del almacenamiento después de borrar sus registros. No lanza:
 * un archivo que no se pudo borrar queda huérfano y lo limpia
 * scripts/cleanup-attachments.ts.
 */
export async function deleteStoredFiles(keys: string[]): Promise<void> {
  const storage = getStorage();
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (error) {
      console.error(`No se pudo borrar el adjunto ${key}:`, error);
    }
  }
}

/** Borra todos los archivos de un usuario (al limpiar sus datos o eliminarlo) */
export async function deleteUserFiles(userId: string): Promise<void> {
  try {
    await getStorage().deletePrefix(userId);
  } catch (error) {
    console.error(`No se pudieron borrar los adjuntos de ${userId}:`, error);
  }
}

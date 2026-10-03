/**
 * Límites de los adjuntos, compartidos entre el navegador (aviso antes de
 * subir) y el servidor (validación real).
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 10;

/** Tipos que se guardan: las imágenes se convierten a JPEG */
export const ATTACHMENT_MIME_TYPES = ["image/jpeg", "application/pdf"];

/** Lo que acepta el selector de archivos (la validación real es en el servidor) */
export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export type AttachmentInfo = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
};

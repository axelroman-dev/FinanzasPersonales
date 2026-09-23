import { z } from "zod";

/**
 * Reglas del asistente de configuración inicial compartidas entre el
 * navegador y el servidor.
 */

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Intentos fallidos del código antes de invalidarlo */
export const MAX_SETUP_ATTEMPTS = 5;

/**
 * Normaliza el código escrito por el usuario: mayúsculas y sin guiones ni
 * espacios, para aceptar "abcd-efgh", "ABCD EFGH" o "abcdefgh".
 */
export function normalizeSetupCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const setupSchema = z.object({
  code: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_ADMIN_PASSWORD_LENGTH).max(100),
  allowRegistration: z.boolean(),
});

export type SetupInput = z.infer<typeof setupSchema>;

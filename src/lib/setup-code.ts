import { createHash, randomInt, timingSafeEqual } from "crypto";
import { normalizeSetupCode } from "@/lib/setup-rules";

/** Sin 0/O ni 1/I para que el código se lea sin ambigüedad en los logs */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Genera un código como "K7QM-3XPD" (32^8 ≈ 10^12 combinaciones) */
export function generateSetupCode(): string {
  const chars = Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Hash que se guarda en la DB (nunca el código en claro) */
export function hashSetupCode(code: string): string {
  return createHash("sha256").update(normalizeSetupCode(code)).digest("hex");
}

/** Compara un código escrito contra el hash guardado en tiempo constante */
export function setupCodeMatches(input: string, storedHash: string): boolean {
  const a = Buffer.from(hashSetupCode(input), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

import { randomUUID } from "node:crypto";

/** Formato de una key: "<userId>/<uuid>". La genera siempre el servidor */
export const STORAGE_KEY_RE =
  /^[a-z0-9]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const USER_ID_RE = /^[a-z0-9]+$/;

export function newStorageKey(userId: string): string {
  if (!USER_ID_RE.test(userId)) throw new Error(`Usuario inválido: ${userId}`);
  return `${userId}/${randomUUID()}`;
}

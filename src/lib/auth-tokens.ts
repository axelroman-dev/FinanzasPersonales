import { createHash, randomBytes } from "crypto";
import type { AuthTokenType } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Cuánto vale cada tipo de enlace */
export const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  PASSWORD_RESET: 60 * 60 * 1000,
  INVITE: 7 * 24 * 60 * 60 * 1000,
};

/** Token para el enlace: 32 bytes aleatorios en base64url (sin = / +) */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** En la base solo se guarda el SHA-256: con un respaldo filtrado no se puede usar */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crea un enlace de un solo uso y devuelve el token en claro (para el correo).
 * Los enlaces anteriores del mismo tipo dejan de valer.
 */
export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
  now: Date = new Date()
): Promise<string> {
  const token = generateToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]),
      },
    }),
  ]);
  return token;
}

/** Enlace vigente (sin usar ni vencido) con su usuario, o null */
export async function findValidAuthToken(token: string, type: AuthTokenType, now = new Date()) {
  if (!token) return null;
  return prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type, usedAt: null, expiresAt: { gt: now } },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
  });
}

/**
 * Gasta el enlace y devuelve el id del usuario, o null si no vale. El update
 * condicionado hace que dos usos simultáneos no puedan pasar los dos.
 */
export async function consumeAuthToken(
  token: string,
  type: AuthTokenType,
  now: Date = new Date()
): Promise<string | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count === 0) return null;
  const row = await prisma.authToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  return row?.userId ?? null;
}

/** Enlaces de un tipo pedidos por el usuario desde `since` (límite de solicitudes) */
export function countRecentAuthTokens(userId: string, type: AuthTokenType, since: Date) {
  return prisma.authToken.count({ where: { userId, type, createdAt: { gte: since } } });
}

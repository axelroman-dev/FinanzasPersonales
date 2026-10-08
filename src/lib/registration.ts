import { createHmac, randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { seedDefaultCategories } from "@/lib/categories";
import { sendMail } from "@/lib/mail/send";
import { verificationCodeEmail } from "@/lib/mail/templates";

/**
 * Registro público con verificación de correo: los datos esperan en
 * PendingRegistration con un código de 6 dígitos, y la cuenta se crea hasta
 * que se escribe el código. Sin correo configurado, /api/register crea la
 * cuenta directo como antes.
 */
export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

type Result = { ok: true } | { ok: false; error: string; status: number };

/** Código de 6 dígitos (con ceros a la izquierda) */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Huella del código ligada al correo y firmada con NEXTAUTH_SECRET: con un
 * millón de códigos posibles, un SHA-256 simple se adivinaría probando todos
 */
export function hashCode(email: string, code: string): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(`${email}:${code}`)
    .digest("hex");
}

export function codeMatches(storedHash: string, email: string, code: string): boolean {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashCode(email, code), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function emailTaken(email: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  return !!user;
}

/**
 * Guarda un código nuevo y lo manda por correo. Con `passwordHash` crea o
 * reemplaza el registro (paso 1); sin él solo renueva el código (reenviar).
 */
async function issueCode(email: string, name: string, passwordHash?: string) {
  const code = generateCode();
  const now = new Date();
  const fresh = {
    name,
    codeHash: hashCode(email, code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    attempts: 0,
    lastSentAt: now,
  };
  if (passwordHash) {
    await prisma.pendingRegistration.upsert({
      where: { email },
      create: { email, passwordHash, ...fresh },
      update: { passwordHash, ...fresh },
    });
  } else {
    await prisma.pendingRegistration.update({ where: { email }, data: fresh });
  }
  return sendMail(
    email,
    verificationCodeEmail({ name, code, expiresInMinutes: CODE_TTL_MS / 60_000 })
  );
}

/** Paso 1: guarda los datos del registro y manda el código */
export async function startRegistration(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result> {
  const email = normalizeEmail(input.email);
  if (await emailTaken(email)) {
    return { ok: false, error: "Ya existe una cuenta con ese email", status: 409 };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  // Volvió a «Cambiar datos» hace poco: se guardan los datos nuevos y sigue
  // valiendo el código que ya le llegó (no se manda otro tan seguido)
  const existing = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (
    existing &&
    existing.expiresAt > new Date() &&
    Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    await prisma.pendingRegistration.update({
      where: { email },
      data: { name: input.name.trim(), passwordHash },
    });
    return { ok: true };
  }

  // Limpieza de registros que nadie terminó
  await prisma.pendingRegistration.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const sent = await issueCode(email, input.name.trim(), passwordHash);
  if (!sent.ok) {
    return { ok: false, error: "No pudimos enviar el código. Intenta más tarde.", status: 502 };
  }
  return { ok: true };
}

/** Manda un código nuevo para un registro pendiente */
export async function resendCode(rawEmail: string): Promise<Result> {
  const email = normalizeEmail(rawEmail);
  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (!pending) {
    return { ok: false, error: "No hay un registro pendiente con ese correo", status: 404 };
  }
  if (Date.now() - pending.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Espera un minuto para pedir otro código", status: 429 };
  }
  const sent = await issueCode(email, pending.name);
  if (!sent.ok) {
    return { ok: false, error: "No pudimos enviar el código. Intenta más tarde.", status: 502 };
  }
  return { ok: true };
}

/** Paso 2: comprueba el código y crea la cuenta */
export async function verifyRegistration(rawEmail: string, code: string): Promise<Result> {
  const email = normalizeEmail(rawEmail);
  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (!pending) {
    return { ok: false, error: "Ese código ya no es válido. Regístrate de nuevo.", status: 404 };
  }
  if (pending.expiresAt < new Date()) {
    return { ok: false, error: "El código venció. Pide uno nuevo.", status: 410 };
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Demasiados intentos. Pide un código nuevo.", status: 429 };
  }
  if (!codeMatches(pending.codeHash, email, code.trim())) {
    const { attempts } = await prisma.pendingRegistration.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    const left = MAX_ATTEMPTS - attempts;
    return {
      ok: false,
      error:
        left > 0
          ? `Código incorrecto. Te quedan ${left} intento${left === 1 ? "" : "s"}.`
          : "Demasiados intentos. Pide un código nuevo.",
      status: 400,
    };
  }

  // Alguien pudo registrarse con ese correo mientras tanto (p. ej. un admin)
  if (await emailTaken(email)) {
    await prisma.pendingRegistration.delete({ where: { email } });
    return { ok: false, error: "Ya existe una cuenta con ese email", status: 409 };
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: pending.name,
        email,
        passwordHash: pending.passwordHash,
        role: "USER",
        isActive: true,
      },
    });
    await tx.pendingRegistration.delete({ where: { email } });
    return created;
  });
  await seedDefaultCategories(user.id);
  return { ok: true };
}

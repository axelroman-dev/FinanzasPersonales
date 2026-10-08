import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getRegistrationConfig } from "@/lib/admin";
import { seedDefaultCategories } from "@/lib/categories";
import { mailEnabled } from "@/lib/mail/config";
import { startRegistration } from "@/lib/registration";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const perIp = createRateLimiter(10, 60 * 60 * 1000);

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

/**
 * POST /api/register — con correo configurado manda un código para confirmar
 * el correo (la cuenta se crea en /api/register/verify); sin correo, crea la
 * cuenta directo.
 */
export async function POST(req: Request) {
  try {
    if (!perIp.take(clientIp(req))) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo más tarde." },
        { status: 429 }
      );
    }
    const allowed = await getRegistrationConfig();
    if (!allowed) {
      return NextResponse.json(
        { error: "Registro deshabilitado" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    if (mailEnabled()) {
      const started = await startRegistration({ name, email, password });
      if (!started.ok) {
        return NextResponse.json({ error: started.error }, { status: started.status });
      }
      return NextResponse.json({ ok: true, verify: true });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "USER",
        isActive: true,
      },
    });

    // Crear categorías predeterminadas
    await seedDefaultCategories(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en register:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
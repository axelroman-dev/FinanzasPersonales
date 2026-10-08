import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { notifyPasswordChanged } from "@/lib/mail/notices";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

const perIp = createRateLimiter(20, 60 * 60 * 1000);

/** POST /api/password/reset — pone la contraseña nueva con un enlace válido */
export async function POST(req: Request) {
  if (!perIp.take(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    );
  }

  const userId = await consumeAuthToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) {
    return NextResponse.json(
      { error: "El enlace no es válido o ya venció. Pide uno nuevo." },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      mustChangePassword: false,
      // Cierra las sesiones abiertas en cualquier dispositivo
      passwordChangedAt: new Date(),
    },
    select: { name: true, email: true },
  });
  notifyPasswordChanged(user, "reset");

  return NextResponse.json({ ok: true });
}

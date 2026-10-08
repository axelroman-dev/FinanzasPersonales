import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSystemAdmin } from "@/lib/system-admin";
import { appUrl, mailEnabled } from "@/lib/mail/config";
import { sendMail } from "@/lib/mail/send";
import { passwordResetEmail } from "@/lib/mail/templates";
import { TOKEN_TTL_MS, countRecentAuthTokens, issueAuthToken } from "@/lib/auth-tokens";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email() });

// Por IP: frena a quien prueba muchos correos; por usuario se cuentan los enlaces
const perIp = createRateLimiter(10, 60 * 60 * 1000);
const MAX_PER_USER_PER_HOUR = 3;

/**
 * POST /api/password/forgot — manda el enlace para restablecer la contraseña.
 * Responde siempre lo mismo, exista o no el correo, para no revelar quién
 * tiene cuenta.
 */
export async function POST(req: Request) {
  if (!mailEnabled()) {
    return NextResponse.json(
      { error: "La recuperación por correo no está disponible. Pide ayuda a un administrador." },
      { status: 503 }
    );
  }
  if (!perIp.take(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, isActive: true },
  });

  // El admin del sistema no se restablece por correo (su contraseña vive en el .env)
  if (user && user.isActive && !isSystemAdmin(user)) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await countRecentAuthTokens(user.id, "PASSWORD_RESET", since);
    if (recent < MAX_PER_USER_PER_HOUR) {
      const token = await issueAuthToken(user.id, "PASSWORD_RESET");
      await sendMail(
        user.email,
        passwordResetEmail({
          name: user.name,
          url: `${appUrl()}/reset-password?token=${token}`,
          expiresInMinutes: TOKEN_TTL_MS.PASSWORD_RESET / 60_000,
        })
      );
    }
  }

  return NextResponse.json({ ok: true });
}

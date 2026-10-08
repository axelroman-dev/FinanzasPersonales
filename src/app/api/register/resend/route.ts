import { NextResponse } from "next/server";
import { z } from "zod";
import { getRegistrationConfig } from "@/lib/admin";
import { resendCode } from "@/lib/registration";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email() });

const perIp = createRateLimiter(10, 60 * 60 * 1000);

/** POST /api/register/resend — manda otro código al registro pendiente */
export async function POST(req: Request) {
  if (!perIp.take(clientIp(req))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }
  if (!(await getRegistrationConfig())) {
    return NextResponse.json({ error: "Registro deshabilitado" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const result = await resendCode(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

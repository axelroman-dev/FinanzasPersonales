import { NextResponse } from "next/server";
import { z } from "zod";
import { getRegistrationConfig } from "@/lib/admin";
import { verifyRegistration } from "@/lib/registration";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});

const perIp = createRateLimiter(30, 60 * 60 * 1000);

/** POST /api/register/verify — confirma el código y crea la cuenta */
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const result = await verifyRegistration(parsed.data.email, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

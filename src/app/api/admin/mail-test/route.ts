import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail/config";
import { sendMail } from "@/lib/mail/send";
import { testEmail } from "@/lib/mail/templates";

const schema = z.object({ to: z.string().trim().email() });

/** POST /api/admin/mail-test — manda un correo de prueba para revisar la configuración */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!mailEnabled()) {
    return NextResponse.json({ error: "El correo no está configurado" }, { status: 400 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido" }, { status: 400 });
  }
  const result = await sendMail(parsed.data.to, testEmail({ name: admin.name }));
  if (!result.ok) {
    return NextResponse.json({ error: `No se pudo enviar: ${result.error}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

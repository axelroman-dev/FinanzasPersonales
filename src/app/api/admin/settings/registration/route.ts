import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { setRegistrationConfig } from "@/lib/admin";

const schema = z.object({ allow: z.boolean() });

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    await setRegistrationConfig(parsed.data.allow, admin.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json(
      { error: "Error al guardar" },
      { status: 500 }
    );
  }
}
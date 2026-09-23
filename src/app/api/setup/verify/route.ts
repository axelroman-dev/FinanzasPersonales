import { NextResponse } from "next/server";
import { z } from "zod";
import { checkSetupCode, hasAdmin } from "@/lib/setup";

const schema = z.object({ code: z.string().min(1) });

/** Paso 1 del asistente: valida el código sin consumirlo */
export async function POST(req: Request) {
  try {
    if (await hasAdmin()) {
      return NextResponse.json(
        { error: "La configuración inicial ya se completó" },
        { status: 409 }
      );
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const check = await checkSetupCode(parsed.data.code);
    if (check.ok) return NextResponse.json({ ok: true });
    if (check.reason === "no-code") {
      return NextResponse.json(
        {
          error:
            "No hay un código activo. Reinicia el servidor y usa el código nuevo que aparece en los logs.",
        },
        { status: 410 }
      );
    }
    return NextResponse.json(
      {
        error: `Código incorrecto. Te quedan ${check.remaining} ${
          check.remaining === 1 ? "intento" : "intentos"
        }.`,
      },
      { status: 401 }
    );
  } catch (error) {
    console.error("Error en setup/verify:", error);
    return NextResponse.json({ error: "Error al verificar el código" }, { status: 500 });
  }
}

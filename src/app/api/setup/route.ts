import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { checkSetupCode, completeSetup, hasAdmin, SetupError } from "@/lib/setup";
import { setupSchema } from "@/lib/setup-rules";

/** Paso final del asistente: crea el admin y guarda si se permite el registro */
export async function POST(req: Request) {
  try {
    if (await hasAdmin()) {
      return NextResponse.json(
        { error: "La configuración inicial ya se completó" },
        { status: 409 }
      );
    }
    const parsed = setupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Vuelve a validar el código (y cuenta el intento si es incorrecto)
    const check = await checkSetupCode(parsed.data.code);
    if (!check.ok) {
      return NextResponse.json(
        { error: "El código de configuración ya no es válido. Vuelve a empezar." },
        { status: 401 }
      );
    }

    await completeSetup(parsed.data);
    revalidateTag("registration-config");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SetupError) {
      const status = error.reason === "email-taken" ? 409 : error.reason === "code" ? 401 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("Error en setup:", error);
    return NextResponse.json({ error: "Error al completar la configuración" }, { status: 500 });
  }
}

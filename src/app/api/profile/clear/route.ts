import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CLEAR_CONFIRMATION } from "@/lib/danger-zone";
import { clearUserData, passwordMatches } from "@/lib/user-data";

const schema = z.object({
  password: z.string().min(1),
  confirmation: z.literal(CLEAR_CONFIRMATION),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Escribe ${CLEAR_CONFIRMATION} para confirmar` },
        { status: 400 }
      );
    }
    if (!(await passwordMatches(user.id, parsed.data.password))) {
      return NextResponse.json(
        { error: "La contraseña es incorrecta" },
        { status: 400 }
      );
    }

    await clearUserData(user.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Clear user data error:", error);
    return NextResponse.json(
      { error: "Error al limpiar los datos" },
      { status: 500 }
    );
  }
}

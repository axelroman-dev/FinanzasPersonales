import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DELETE_CONFIRMATION } from "@/lib/danger-zone";
import { isSystemAdmin } from "@/lib/system-admin";
import { deleteUser, passwordMatches } from "@/lib/user-data";

const schema = z.object({
  password: z.string().min(1),
  confirmation: z.literal(DELETE_CONFIRMATION),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (isSystemAdmin(user)) {
      return NextResponse.json(
        { error: "El administrador del sistema no se puede eliminar" },
        { status: 403 }
      );
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Escribe ${DELETE_CONFIRMATION} para confirmar` },
        { status: 400 }
      );
    }
    if (!(await passwordMatches(user.id, parsed.data.password))) {
      return NextResponse.json(
        { error: "La contraseña es incorrecta" },
        { status: 400 }
      );
    }

    await deleteUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuenta" },
      { status: 500 }
    );
  }
}

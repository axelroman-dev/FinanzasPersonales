import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { exportUserData } from "@/lib/export-import";

// Descarga con datos de la sesión: nunca se renderiza en estático
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await exportUserData(user.id);

    const filename = `finanzas-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("User export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}

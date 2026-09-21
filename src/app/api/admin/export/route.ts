import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportAllData } from "@/lib/export-import";

export async function GET() {
  try {
    await requireAdmin();
    const data = await exportAllData();

    const filename = `finanzas-global-${new Date().toISOString().split("T")[0]}.json`;

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
    console.error("Global export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
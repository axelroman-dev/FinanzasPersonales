import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { dropMissingAttachments, exportAllData } from "@/lib/export-import";
import { backupZipStream } from "@/lib/backup-zip";

// Descarga con datos de la sesión: nunca se renderiza en estático
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const { json, files } = await exportAllData();

    const filename = `finanzas-global-${new Date().toISOString().split("T")[0]}.zip`;

    // Zip con los datos y los adjuntos (ver src/lib/backup-file.ts)
    return new NextResponse(
      backupZipStream(files, (missing) => {
        for (const u of json.users) dropMissingAttachments(u.data, missing);
        return json;
      }),
      {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      }
    );
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Global export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}
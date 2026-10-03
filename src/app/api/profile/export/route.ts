import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { dropMissingAttachments, exportUserData } from "@/lib/export-import";
import { backupZipStream } from "@/lib/backup-zip";

// Descarga con datos de la sesión: nunca se renderiza en estático
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const { json, files } = await exportUserData(user.id);

    const filename = `finanzas-${new Date().toISOString().split("T")[0]}.zip`;

    // Zip con los datos y los adjuntos (ver src/lib/backup-file.ts)
    return new NextResponse(
      backupZipStream(files, (missing) => {
        dropMissingAttachments(json.data, missing);
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
    console.error("User export error:", error);
    return NextResponse.json({ error: "Error al exportar" }, { status: 500 });
  }
}

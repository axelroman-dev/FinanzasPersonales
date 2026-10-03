import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  previewImport,
  applyImport,
  previewGlobalImport,
  applyGlobalImport,
} from "@/lib/export-import";
import type { ExportData, GlobalExportData } from "@/lib/export-import";
import { readBackup } from "@/lib/backup-file";

// POST /api/import?mode=preview — analiza el JSON y devuelve qué se importaría
// POST /api/import?mode=apply — aplica el import con la estrategia elegida
//
// El cuerpo es JSON ({ json, strategy, isGlobal }) o un formulario con el
// archivo de respaldo (file, strategy, isGlobal). El preview se manda como
// JSON (el navegador extrae los datos del zip); el apply, con el archivo,
// porque lleva los adjuntos.

const strategySchema = z.enum(["create", "overwrite", "skip"]);

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode"); // "preview" | "apply"

    // Antes de leer el cuerpo: un respaldo con adjuntos puede ser grande
    const user = await requireUser();

    let json: ExportData | GlobalExportData;
    let strategy: unknown;
    let isGlobal: boolean;
    let files: Map<string, Uint8Array> | undefined;
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
      }
      try {
        const backup = readBackup(new Uint8Array(await file.arrayBuffer()));
        json = backup.json as ExportData | GlobalExportData;
        files = backup.files;
      } catch {
        return NextResponse.json({ error: "Archivo de respaldo inválido" }, { status: 400 });
      }
      strategy = form.get("strategy") ?? undefined;
      isGlobal = form.get("isGlobal") === "true";
    } else {
      const body = await req.json();
      ({ json, strategy } = body);
      isGlobal = body.isGlobal === true;
    }

    if (!json || typeof json !== "object") {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (mode !== "preview" && mode !== "apply") {
      return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
    }
    const parsedStrategy = strategySchema.safeParse(strategy);
    if (mode === "apply" && !parsedStrategy.success) {
      return NextResponse.json(
        { error: "Estrategia inválida" },
        { status: 400 }
      );
    }

    // Global (solo admin): cada usuario del backup va a su propia cuenta,
    // buscada por email. Por usuario: los datos van al usuario actual.
    if (isGlobal || json.scope === "global") {
      if (user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      const globalJson = json as GlobalExportData;
      if (!Array.isArray(globalJson.users)) {
        return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
      }
      if (mode === "preview") {
        const preview = await previewGlobalImport(globalJson);
        return NextResponse.json({ ...preview, scope: "global" });
      }
      const result = await applyGlobalImport({
        json: globalJson,
        strategy: parsedStrategy.data!,
        files,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const userJson = json as ExportData;
    if (mode === "preview") {
      const preview = await previewImport(user.id, userJson);
      return NextResponse.json({ ...preview, scope: "user" });
    }
    const result = await applyImport({
      userId: user.id,
      json: userJson,
      strategy: parsedStrategy.data!,
      files,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Error al importar" },
      { status: 500 }
    );
  }
}
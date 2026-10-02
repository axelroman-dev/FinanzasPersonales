import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireAdmin } from "@/lib/auth";
import {
  previewImport,
  applyImport,
  previewGlobalImport,
  applyGlobalImport,
} from "@/lib/export-import";
import type { ExportData, GlobalExportData } from "@/lib/export-import";

// POST /api/import/preview — analiza el JSON y devuelve qué se importaría
// POST /api/import/apply — aplica el import con la estrategia elegida

const strategySchema = z.enum(["create", "overwrite", "skip"]);

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode"); // "preview" | "apply"

    const body = await req.json();
    const { json, strategy, isGlobal } = body as {
      json: ExportData | GlobalExportData;
      strategy?: "create" | "overwrite" | "skip";
      isGlobal?: boolean;
    };

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
      await requireAdmin();
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
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const user = await requireUser();
    const userJson = json as ExportData;
    if (mode === "preview") {
      const preview = await previewImport(user.id, userJson);
      return NextResponse.json({ ...preview, scope: "user" });
    }
    const result = await applyImport({
      userId: user.id,
      json: userJson,
      strategy: parsedStrategy.data!,
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
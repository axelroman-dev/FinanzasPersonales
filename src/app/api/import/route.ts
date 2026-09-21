import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, requireAdmin } from "@/lib/auth";
import { previewImport, applyImport } from "@/lib/export-import";
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

    // Si es global, requiere admin. Si es por usuario, usa el user actual.
    let userId: string;
    let scope: "user" | "global";
    if (isGlobal || json.scope === "global") {
      await requireAdmin();
      // Para import global, los datos van al usuario admin actual
      // (la importación global es para backup/restore en una sola cuenta)
      const admin = await requireAdmin();
      userId = admin.id;
      scope = "global";
    } else {
      const user = await requireUser();
      userId = user.id;
      scope = "user";
    }

    if (mode === "preview") {
      const preview = await previewImport(userId, json);
      return NextResponse.json({ ...preview, scope });
    }

    if (mode === "apply") {
      if (!strategy || !strategySchema.safeParse(strategy).success) {
        return NextResponse.json(
          { error: "Estrategia inválida" },
          { status: 400 }
        );
      }
      const parsedStrategy = strategySchema.parse(strategy);
      const result = await applyImport({
        userId,
        json,
        strategy: parsedStrategy,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
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
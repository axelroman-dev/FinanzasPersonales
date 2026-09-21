"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertTriangle, FileJson, ShieldAlert } from "lucide-react";
import type { GlobalExportData, ImportPreview, ImportStrategy } from "@/lib/export-import";

/**
 * Variante del ImportExportPanel pero para export/import global (solo admin).
 * Reutiliza el mismo endpoint pero con isGlobal: true.
 */
export function GlobalImportExportPanel() {
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("create");
  const [json, setJson] = useState<GlobalExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);

  async function handleExport() {
    setError(null);
    const res = await fetch("/api/admin/export");
    if (!res.ok) {
      setError("Error al exportar");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers
        .get("Content-Disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? "finanzas-global.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as GlobalExportData;
      if (!parsed.version || !parsed.users || parsed.scope !== "global") {
        setError(
          "Archivo inválido. Debe ser un export global (scope: 'global')."
        );
        return;
      }
      setJson(parsed);
      setStep("preview");
      const res = await fetch("/api/import?mode=preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: parsed, isGlobal: true }),
      });
      if (!res.ok) {
        setError("Error al analizar el archivo");
        setStep("idle");
        return;
      }
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError("Archivo JSON inválido");
      setStep("idle");
    }
  }

  async function handleApply() {
    if (!json || !preview) return;
    setError(null);
    const res = await fetch("/api/import?mode=apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json, strategy, isGlobal: true }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al importar");
      return;
    }
    const data = await res.json();
    setResult({ created: data.created, updated: data.updated, skipped: data.skipped });
    setStep("done");
  }

  function reset() {
    setStep("idle");
    setPreview(null);
    setJson(null);
    setResult(null);
    setError(null);
  }

  if (step === "preview" && preview) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">Importación global</p>
            <p className="text-amber-300/80 mt-1">
              Este import contiene datos de {json?.users.length ?? 0}{" "}
              usuario(s). Los registros se importarán al usuario admin actual.
              Los IDs de usuario originales se pierden.
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">Resumen</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Cuentas</p>
              <p className="font-semibold">{preview.totalAccounts}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Movimientos</p>
              <p className="font-semibold">{preview.totalTransactions}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Suscripciones</p>
              <p className="font-semibold">{preview.totalSubscriptions}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Categorías</p>
              <p className="font-semibold">{preview.totalCategories}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Estrategia</p>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="create">Crear (duplicados fallarán)</option>
            <option value="overwrite">Sobrescribir existentes</option>
            <option value="skip">Saltar duplicados</option>
          </select>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={reset}>
            Cancelar
          </Button>
          <Button onClick={handleApply}>
            <Upload className="h-4 w-4" />
            Importar todo
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="font-medium text-emerald-400">
            Importación global completada
          </p>
          <ul className="text-sm text-emerald-300/80 mt-1 space-y-0.5">
            <li>{result.created} creado(s)</li>
            <li>{result.updated} actualizado(s)</li>
            <li>{result.skipped} saltado(s)</li>
          </ul>
        </div>
        <Button variant="outline" onClick={reset}>
          Importar otro archivo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleExport} variant="default">
          <Download className="h-4 w-4" />
          Exportar todo (sistema)
        </Button>

        <label className="cursor-pointer">
          <Button variant="outline" type="button" asChild>
            <span>
              <Upload className="h-4 w-4" />
              Importar archivo global
            </span>
          </Button>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1 font-medium">
          <AlertTriangle className="h-3 w-3" />
          Importante
        </p>
        <p>
          El export global contiene datos de <strong>todos</strong> los usuarios
          (sin passwords). El import los aplica al usuario admin actual — no
          crea nuevos usuarios.
        </p>
      </div>
    </div>
  );
}
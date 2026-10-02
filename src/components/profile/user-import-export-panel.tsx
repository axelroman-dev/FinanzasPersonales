"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileJson, Loader2 } from "lucide-react";
import type {
  ExportData,
  ImportPreview,
  ImportResult,
  ImportStrategy,
} from "@/lib/export-import";

/**
 * Export/import de los datos del usuario actual. Versión por usuario del
 * GlobalImportExportPanel (admin), sobre el mismo endpoint /api/import.
 */
export function UserImportExportPanel() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "preview" | "done">("idle");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("skip");
  const [json, setJson] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleExport() {
    setError(null);
    const res = await fetch("/api/profile/export");
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
        ?.match(/filename="([^"]+)"/)?.[1] ?? "finanzas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(await file.text()) as ExportData;
      if (!parsed.version || !parsed.data || parsed.scope !== "user") {
        setError(
          "Archivo inválido. Debe ser un export de tus datos (el export global se importa desde Administración)."
        );
        return;
      }
      const res = await fetch("/api/import?mode=preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: parsed }),
      });
      if (!res.ok) {
        setError("Error al analizar el archivo");
        return;
      }
      const data = (await res.json()) as ImportPreview;
      if (data.errors.length > 0) {
        setError(data.errors.join(". "));
        return;
      }
      setJson(parsed);
      setPreview(data);
      setStep("preview");
    } catch {
      setError("Archivo JSON inválido");
    }
  }

  async function handleApply() {
    if (!json) return;
    setError(null);
    setIsPending(true);
    const res = await fetch("/api/import?mode=apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json, strategy }),
    });
    setIsPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al importar");
      return;
    }
    setResult(await res.json());
    setStep("done");
    router.refresh();
  }

  function reset() {
    setStep("idle");
    setPreview(null);
    setJson(null);
    setResult(null);
    setError(null);
  }

  const errorBox = error && (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
      {error}
    </div>
  );

  if (step === "preview" && preview) {
    const duplicates =
      preview.duplicates.accounts.length +
      preview.duplicates.subscriptions.length +
      preview.duplicates.categories.length;
    return (
      <div className="space-y-4">
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
          {duplicates > 0 && (
            <p className="text-xs text-muted-foreground">
              {duplicates} elemento(s) ya existen en tu cuenta (mismo nombre).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Si algo ya existe</p>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="skip">Saltar duplicados</option>
            <option value="overwrite">Sobrescribir existentes</option>
            <option value="create">Crear (duplicados fallarán)</option>
          </select>
        </div>

        {errorBox}

        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="font-medium text-emerald-400">Importación completada</p>
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
        <Button onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exportar mis datos
        </Button>
        <label className="cursor-pointer">
          <Button variant="outline" type="button" asChild>
            <span>
              <Upload className="h-4 w-4" />
              Importar archivo
            </span>
          </Button>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>
      {errorBox}
    </div>
  );
}

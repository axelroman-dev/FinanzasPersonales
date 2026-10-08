"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Manda un correo de prueba a la dirección indicada */
export function MailTest({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mail-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? { ok: true, text: `Enviado a ${to}. Revisa la bandeja de entrada (y spam).` }
          : { ok: false, text: data.error || "No se pudo enviar" }
      );
    } catch {
      setResult({ ok: false, text: "No se pudo enviar" });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="correo@ejemplo.com"
          aria-label="Enviar la prueba a"
        />
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar correo de prueba
        </Button>
      </div>
      {result && (
        <p className={`text-sm ${result.ok ? "text-primary" : "text-destructive"}`}>{result.text}</p>
      )}
    </form>
  );
}

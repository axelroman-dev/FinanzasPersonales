"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      const res = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setSentTo(email);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setIsPending(false);
    }
  }

  if (sentTo) {
    // El mismo mensaje exista o no la cuenta: no se revela quién está registrado
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <p className="text-sm">
          Si <span className="font-medium">{sentTo}</span> tiene una cuenta, te enviamos un
          enlace para crear una contraseña nueva. Vence en 1 hora.
        </p>
        <p className="text-xs text-muted-foreground">
          ¿No llega? Revisa tu carpeta de spam.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña
        nueva.
      </p>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Enviando..." : "Enviar enlace"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== data.get("confirm")) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "No se pudo guardar. Intenta de nuevo.");
        setIsPending(false);
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Para que el gestor de contraseñas la guarde con el usuario correcto */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <p className="text-sm text-muted-foreground">
        Cuenta: <span className="font-medium text-foreground">{email}</span>
      </p>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña nueva</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}

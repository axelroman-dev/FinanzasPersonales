"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function ChangePasswordForm({
  isMandatory = false,
  userName,
  userEmail,
}: {
  isMandatory?: boolean;
  userName?: string;
  userEmail?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al cambiar contraseña");
        return;
      }

      // El JWT actual todavía trae mustChangePassword: true.
      // Refrescamos la sesión re-autenticando con la nueva contraseña
      // para que el middleware vea el flag actualizado.
      if (!userEmail) {
        // Sin email no podemos re-autenticar; forzar al dashboard
        router.refresh();
        router.push("/");
        return;
      }

      const { signIn } = await import("next-auth/react");
      const result = await signIn("credentials", {
        email: userEmail,
        password: newPassword,
        redirect: false,
      });

      if (result?.error) {
        setError("Contraseña cambiada pero no se pudo refrescar la sesión. Cierra sesión manualmente.");
        return;
      }

      router.refresh();
      router.push("/");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!isMandatory && userName && (
        <div className="text-sm text-muted-foreground">
          Cambiar contraseña para <strong className="text-foreground">{userName}</strong>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          autoFocus={isMandatory}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Cambiar contraseña
      </Button>
    </form>
  );
}
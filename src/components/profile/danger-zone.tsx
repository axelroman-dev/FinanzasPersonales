"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Loader2, Trash2 } from "lucide-react";
import { CLEAR_CONFIRMATION, DELETE_CONFIRMATION } from "@/lib/danger-zone";

export function DangerZone({ canDelete }: { canDelete: boolean }) {
  const router = useRouter();

  return (
    <div className="divide-y">
      <DangerAction
        title="Limpiar mis datos"
        description="Borra tus cuentas, movimientos y suscripciones, y deja las categorías predeterminadas. Tu usuario se conserva."
        buttonLabel="Limpiar datos"
        icon={<Eraser className="h-4 w-4" />}
        endpoint="/api/profile/clear"
        confirmation={CLEAR_CONFIRMATION}
        onDone={() => router.refresh()}
      />
      {canDelete && (
        <DangerAction
          title="Eliminar mi cuenta"
          description="Borra tu usuario y todos tus datos, y cierra la sesión."
          buttonLabel="Eliminar cuenta"
          icon={<Trash2 className="h-4 w-4" />}
          endpoint="/api/profile/delete"
          confirmation={DELETE_CONFIRMATION}
          onDone={() => signOut({ callbackUrl: "/login" })}
        />
      )}
    </div>
  );
}

function DangerAction({
  title,
  description,
  buttonLabel,
  icon,
  endpoint,
  confirmation,
  onDone,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  icon: React.ReactNode;
  endpoint: string;
  confirmation: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword("");
      setTyped("");
      setError(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation: typed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo completar la acción");
        return;
      }
      onOpenChange(false);
      setSuccess(true);
      onDone();
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {success && (
          <p className="text-sm text-emerald-400 mt-1">Listo.</p>
        )}
      </div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="shrink-0">
            {icon}
            {buttonLabel}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description} Esta acción no se puede deshacer; si quieres
              conservar una copia, exporta tus datos antes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${endpoint}-password`}>Contraseña actual</Label>
              <Input
                id={`${endpoint}-password`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${endpoint}-confirm`}>
                Escribe <strong>{confirmation}</strong> para confirmar
              </Label>
              <Input
                id={`${endpoint}-confirm`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending || !password || typed !== confirmation}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {buttonLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

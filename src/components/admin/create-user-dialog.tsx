"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogActions,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail } from "lucide-react";
import { useFormResetKey } from "@/hooks/use-form-reset-key";
import { useAlert } from "@/components/shared/confirm-dialog";

export function CreateUserDialog({
  children,
  canInvite,
}: {
  children?: React.ReactNode;
  /** Hay correo configurado: se puede invitar en vez de poner contraseña */
  canInvite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formKey = useFormResetKey(open);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <CreateUserForm key={formKey} canInvite={canInvite} onClose={() => setOpen(false)} />
    </Dialog>
  );
}

function CreateUserForm({ canInvite, onClose }: { canInvite: boolean; onClose: () => void }) {
  const router = useRouter();
  const showAlert = useAlert();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  // Con correo, por defecto se invita; la contraseña temporal queda como opción
  const [invite, setInvite] = useState(canInvite);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, ...(!invite && { password }) }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al crear usuario");
        return;
      }

      onClose();
      router.refresh();
      if (data.invited && !data.inviteSent) {
        showAlert({
          title: "Usuario creado, pero el correo no se envió",
          description:
            "Revisa la configuración de correo y reenvía la invitación desde el menú del usuario.",
        });
      }
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Crear nuevo usuario</DialogTitle>
        <DialogDescription>
          {invite
            ? "Le enviaremos un correo para que cree su propia contraseña."
            : "Deberá cambiar la contraseña temporal al iniciar sesión por primera vez."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="Ej. Juan Pérez"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="juan@ejemplo.com"
            // Es el email de otra persona: que el navegador no ponga el tuyo
            autoComplete="off"
          />
        </div>

        {invite ? (
          <div className="flex gap-3 rounded-md border border-dashed p-3 text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1">
              <p>
                Recibirá una invitación en su correo para crear su contraseña. El enlace vence en 7
                días y lo puedes reenviar desde la lista.
              </p>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setInvite(false)}
              >
                Mejor poner una contraseña temporal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                // Contraseña nueva: que el gestor de contraseñas no rellene la tuya
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                El usuario deberá cambiarla en su primer inicio de sesión
              </p>
            </div>
            {canInvite && (
              <button
                type="button"
                className="-mt-2 text-xs text-primary hover:underline"
                onClick={() => setInvite(true)}
              >
                Mejor enviar una invitación por correo
              </button>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "USER" | "ADMIN")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">Usuario</SelectItem>
              <SelectItem value="ADMIN">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Fijos abajo: siguen a la vista con el teclado del celular abierto */}
        <DialogActions className="justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {invite ? "Enviar invitación" : "Crear usuario"}
          </Button>
        </DialogActions>
      </form>
    </DialogContent>
  );
}

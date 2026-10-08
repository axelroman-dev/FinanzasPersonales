"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  KeyRound,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Power,
  Trash2,
} from "lucide-react";
import { useAlert, useConfirm } from "@/components/shared/confirm-dialog";

type UserActionsData = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  isSelf: boolean;
  isSystem: boolean;
  /** Invitado que aún no crea su contraseña */
  invitePending: boolean;
  /** Hay correo configurado */
  canEmail: boolean;
};

export function UserActions({ user }: { user: UserActionsData }) {
  const router = useRouter();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const [isPending, startTransition] = useTransition();
  const locked = user.isSelf || user.isSystem;

  function call(action: string, body: any) {
    startTransition(async () => {
      await fetch(`/api/admin/users/${user.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    });
  }

  /** Manda un correo y avisa si salió o por qué no */
  function sendEmail(action: "resend-invite" | "send-reset", sentTitle: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${user.id}/${action}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      showAlert(
        res.ok
          ? { title: sentTitle, description: `Se envió a ${user.email}.` }
          : { title: "No se pudo enviar", description: data.error || "Error al enviar" }
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => call("toggle-active", {})}
          disabled={locked}
        >
          <Power className="h-4 w-4" />
          {user.isActive ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => call("toggle-role", {})}
          disabled={locked}
        >
          {user.role === "ADMIN" ? (
            <>
              <ShieldOff className="h-4 w-4" />
              Quitar admin
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Hacer admin
            </>
          )}
        </DropdownMenuItem>
        {user.canEmail && !user.isSystem && (
          <>
            <DropdownMenuSeparator />
            {user.invitePending ? (
              <DropdownMenuItem onClick={() => sendEmail("resend-invite", "Invitación reenviada")}>
                <Mail className="h-4 w-4" />
                Reenviar invitación
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => sendEmail("send-reset", "Enlace enviado")}
                disabled={!user.isActive}
              >
                <KeyRound className="h-4 w-4" />
                Enviar enlace para restablecer contraseña
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            const ok = await confirm({
              title: "¿Eliminar este usuario?",
              description:
                "Se borrarán el usuario y todos sus datos: cuentas, movimientos, suscripciones y categorías. Esta acción no se puede deshacer.",
              confirmLabel: "Eliminar usuario",
              destructive: true,
            });
            if (ok) call("delete", {});
          }}
          disabled={locked}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
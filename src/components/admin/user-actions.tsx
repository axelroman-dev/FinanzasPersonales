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
import { Loader2, MoreHorizontal, Shield, ShieldOff, Power, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";

type UserActionsData = {
  id: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  isSelf: boolean;
  isSystem: boolean;
};

export function UserActions({ user }: { user: UserActionsData }) {
  const router = useRouter();
  const confirm = useConfirm();
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
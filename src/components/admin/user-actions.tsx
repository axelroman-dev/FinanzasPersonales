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

type UserActionsData = {
  id: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  isSelf: boolean;
};

export function UserActions({ user }: { user: UserActionsData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
          disabled={user.isSelf}
        >
          <Power className="h-4 w-4" />
          {user.isActive ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => call("toggle-role", {})}
          disabled={user.isSelf}
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
          onClick={() => {
            if (!confirm("¿Eliminar este usuario y todos sus datos?")) return;
            call("delete", {});
          }}
          disabled={user.isSelf}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
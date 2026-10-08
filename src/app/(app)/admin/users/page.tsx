import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/utils";
import { UserActions } from "@/components/admin/user-actions";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Plus } from "lucide-react";
import { isSystemAdmin } from "@/lib/system-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { accounts: true, transactions: true } },
    },
  });

  const actionsData = (u: (typeof users)[number]) => ({
    id: u.id,
    role: u.role,
    isActive: u.isActive,
    isSelf: u.id === admin.id,
    isSystem: isSystemAdmin(u),
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <CreateUserDialog>
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        </CreateUserDialog>
      </div>

      {/* Móvil y tablet: tarjetas; la tabla de 7 columnas no cabe */}
      <Card className="divide-y lg:hidden">
        {users.map((u) => (
          <div key={u.id} className="flex gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{u.name}</p>
                  <UserFlags user={u} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={u.role} />
                <StatusBadge isActive={u.isActive} />
              </div>
              <p className="text-xs text-muted-foreground">
                {u._count.accounts} cuenta(s) · {u._count.transactions} movimiento(s) · desde{" "}
                {formatShortDate(u.createdAt)}
              </p>
            </div>
            <div className="-mr-2 shrink-0 self-start">
              <UserActions user={actionsData(u)} />
            </div>
          </div>
        ))}
      </Card>

      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cuentas</th>
                <th className="px-4 py-3">Movimientos</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <UserFlags user={u} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={u.isActive} />
                  </td>
                  <td className="px-4 py-3 text-sm">{u._count.accounts}</td>
                  <td className="px-4 py-3 text-sm">{u._count.transactions}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatShortDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions user={actionsData(u)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

/** Marcas junto al nombre: admin del sistema y contraseña pendiente */
function UserFlags({
  user,
}: {
  user: Parameters<typeof isSystemAdmin>[0] & { mustChangePassword: boolean };
}) {
  return (
    <>
      {isSystemAdmin(user) && (
        <Badge
          variant="outline"
          className="text-[10px]"
          title="Cuenta fija; la contraseña se configura en el .env"
        >
          Sistema
        </Badge>
      )}
      {user.mustChangePassword && (
        <Badge variant="warning" className="text-[10px]" title="Debe cambiar contraseña">
          ⚠ Pendiente
        </Badge>
      )}
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
      {role === "ADMIN" ? "Admin" : "Usuario"}
    </Badge>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "success" : "destructive"}>
      {isActive ? "Activo" : "Inactivo"}
    </Badge>
  );
}

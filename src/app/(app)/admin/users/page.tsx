import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/utils";
import { UserActions } from "@/components/admin/user-actions";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { accounts: true, transactions: true } },
    },
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

      <Card>
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
                      {u.mustChangePassword && (
                        <Badge
                          variant="warning"
                          className="text-[10px]"
                          title="Debe cambiar contraseña"
                        >
                          ⚠ Pendiente
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role === "ADMIN" ? "Admin" : "Usuario"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? "success" : "destructive"}>
                      {u.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{u._count.accounts}</td>
                  <td className="px-4 py-3 text-sm">{u._count.transactions}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatShortDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions
                      user={{
                        id: u.id,
                        role: u.role,
                        isActive: u.isActive,
                        isSelf: u.id === admin.id,
                      }}
                    />
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
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";
import { ChangePasswordForm } from "@/app/change-password/change-password-form";
import { isSystemAdmin } from "@/lib/system-admin";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const isSystem = isSystemAdmin(user);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground">
          Administra tu información personal y contraseña
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información personal</CardTitle>
          <CardDescription>
            Actualiza tu nombre. El email no se puede cambiar desde aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialName={user.name}
            initialEmail={user.email}
            role={user.role}
            isSystem={isSystem}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            {isSystem
              ? "La contraseña del administrador del sistema se configura en el servidor"
              : "Necesitarás tu contraseña actual para confirmar el cambio"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSystem ? (
            <p className="text-sm text-muted-foreground">
              Cambia <code>ADMIN_PASSWORD</code> en el <code>.env</code> y
              reinicia el servidor.
            </p>
          ) : (
            <ChangePasswordForm userName={user.name} userEmail={user.email} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
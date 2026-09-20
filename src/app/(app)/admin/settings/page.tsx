import { requireAdmin } from "@/lib/auth";
import { getRegistrationConfig } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationToggle } from "@/components/admin/registration-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { formatDate } from "@/lib/utils";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const [allowReg, config] = await Promise.all([
    getRegistrationConfig(),
    prisma.appConfig.findUnique({
      where: { id: "singleton" },
      include: { updatedBy: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <>
      <AdminNav />
      <Card>
        <CardHeader>
          <CardTitle>Registro de usuarios</CardTitle>
          <CardDescription>
            Controla si nuevos usuarios pueden registrarse en la plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrationToggle initial={allowReg} />
          {config?.updatedBy && (
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              Última actualización: {formatDate(config.updatedAt)} por{" "}
              {config.updatedBy.name}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
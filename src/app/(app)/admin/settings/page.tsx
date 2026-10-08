import { requireAdmin } from "@/lib/auth";
import { getRegistrationConfig } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationToggle } from "@/components/admin/registration-toggle";
import { GlobalImportExportPanel } from "@/components/settings/global-import-export-panel";
import { formatDate } from "@/lib/utils";
import { getMailConfig } from "@/lib/mail/config";
import { isSystemAdmin } from "@/lib/system-admin";
import { MailTest } from "@/components/admin/mail-test";
import { Badge } from "@/components/ui/badge";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const mail = getMailConfig();
  const [allowReg, config] = await Promise.all([
    getRegistrationConfig(),
    prisma.appConfig.findUnique({
      where: { id: "singleton" },
      include: { updatedBy: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <>
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Correo</CardTitle>
            <Badge variant={mail ? "success" : "secondary"}>
              {mail ? "Configurado" : "Desactivado"}
            </Badge>
          </div>
          <CardDescription>
            Se usa para invitar usuarios, verificar el correo en el registro, recuperar
            contraseñas y avisos de seguridad. Se configura con las variables SMTP_* del .env.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mail ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Servidor</dt>
                <dd className="break-all">
                  {mail.host}:{mail.port} {mail.secure ? "(SSL)" : "(STARTTLS)"}
                </dd>
                <dt className="text-muted-foreground">Remitente</dt>
                <dd className="break-all">{mail.from}</dd>
              </dl>
              {/* El admin del sistema no tiene un correo real */}
              <MailTest defaultTo={isSystemAdmin(admin) ? "" : admin.email} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Agrega SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y MAIL_FROM al .env y
              reinicia la app. Mientras tanto, los usuarios nuevos se crean con contraseña
              temporal y la recuperación de contraseña está desactivada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportar e importar datos</CardTitle>
          <CardDescription>
            Descarga un backup completo del sistema, o restaura datos desde un
            archivo exportado previamente (.zip, o .json de versiones anteriores).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GlobalImportExportPanel />
        </CardContent>
      </Card>
    </>
  );
}
import Link from "next/link";
import { AuthShell } from "@/components/shared/auth-shell";
import { mailEnabled } from "@/lib/mail/config";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthShell subtitle="Recupera tu contraseña">
      {mailEnabled() ? (
        <ForgotPasswordForm />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            La recuperación por correo no está disponible. Pide a un administrador que te
            ayude a restablecer tu contraseña.
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

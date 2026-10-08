import { LoginForm } from "./login-form";
import { getRegistrationConfig } from "@/lib/admin";
import { mailEnabled } from "@/lib/mail/config";
import { AuthShell } from "@/components/shared/auth-shell";

// Forzar render dinámico: necesitamos consultar la DB en cada request
// para saber si el registro está habilitado.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string; reset?: string };
}) {
  const allowRegistration = await getRegistrationConfig();

  return (
    <AuthShell subtitle="Inicia sesión">
      {searchParams.reset === "1" && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          Tu contraseña se actualizó. Inicia sesión con la nueva.
        </div>
      )}
      <LoginForm
        callbackUrl={searchParams.callbackUrl}
        error={searchParams.error}
        allowRegistration={allowRegistration}
        canResetPassword={mailEnabled()}
      />
    </AuthShell>
  );
}

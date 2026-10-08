import Link from "next/link";
import { AuthShell } from "@/components/shared/auth-shell";
import { findValidAuthToken } from "@/lib/auth-tokens";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const valid = await findValidAuthToken(token, "PASSWORD_RESET");

  return (
    <AuthShell subtitle="Crea una contraseña nueva">
      {valid ? (
        <ResetPasswordForm token={token} email={valid.user.email} />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Este enlace no es válido o ya venció. Los enlaces duran 1 hora y solo se
            pueden usar una vez.
          </p>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

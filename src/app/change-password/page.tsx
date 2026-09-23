import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  // Si NO debe cambiar contraseña, redirigir al dashboard
  if (!user.mustChangePassword) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-amber-500"
            >
              <path d="M12 9v2a2 2 0 0 1-2 2H6" />
              <path d="M12 9V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
              <rect x="2" y="9" width="20" height="11" rx="2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Cambia tu contraseña</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tu cuenta tiene una contraseña temporal.
            Por seguridad, debes cambiarla antes de continuar.
          </p>
        </div>

        <ChangePasswordForm
          isMandatory
          userName={user.name}
          userEmail={user.email}
        />

        <p className="text-xs text-muted-foreground text-center mt-4">
          Sesión iniciada como <strong>{user.email}</strong>
        </p>
      </div>
    </div>
  );
}
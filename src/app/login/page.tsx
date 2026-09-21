import { LoginForm } from "./login-form";
import { getRegistrationConfig } from "@/lib/admin";

// Forzar render dinámico: necesitamos consultar la DB en cada request
// para saber si el registro está habilitado.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const allowRegistration = await getRegistrationConfig();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M19 7V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Finanzas Personales</h1>
          <p className="text-sm text-muted-foreground mt-1">Inicia sesión</p>
        </div>
        <LoginForm
          callbackUrl={searchParams.callbackUrl}
          error={searchParams.error}
          allowRegistration={allowRegistration}
        />
      </div>
    </div>
  );
}
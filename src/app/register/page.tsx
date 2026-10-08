import { RegisterForm } from "./register-form";
import { Wallet } from "lucide-react";
import { getRegistrationConfig } from "@/lib/admin";

// Forzar render dinámico: consultar DB en cada request
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const allowRegistration = await getRegistrationConfig();

  if (!allowRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-muted-foreground"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Registro deshabilitado</h1>
          <p className="text-sm text-muted-foreground">
            El registro de nuevos usuarios está deshabilitado por el
            administrador. Si necesitas una cuenta, contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mb-4">
            {/* El logo de la app, como en el login */}
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Únete para gestionar tus finanzas
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
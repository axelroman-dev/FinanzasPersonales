import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { hasAdmin } from "@/lib/setup";
import { SetupWizard } from "./setup-wizard";

// Consultar la DB en cada request: la página deja de existir al crear el admin
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdmin()) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mb-4">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Configuración inicial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea la cuenta de administrador
          </p>
        </div>
        <SetupWizard />
      </div>
    </div>
  );
}

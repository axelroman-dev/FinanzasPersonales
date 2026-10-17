import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCurrencyFormProps } from "@/lib/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencySettingsForm } from "@/components/profile/currency-settings-form";

export const dynamic = "force-dynamic";

/**
 * Configuración inicial de una cuenta nueva: moneda principal, secundarias y
 * proveedor del tipo de cambio. Hasta guardarla, (app)/layout.tsx manda aquí.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  if (user.onboardedAt) redirect("/");
  const currencyForm = await getCurrencyFormProps(user);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mb-4">
            <Coins className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">
            Te damos la bienvenida, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Antes de empezar, elige tus monedas y de dónde sale el tipo de cambio.
            Puedes cambiarlo después en Mi perfil.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <CurrencySettingsForm {...currencyForm} mode="welcome" />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Sesión iniciada como <strong>{user.email}</strong>
        </p>
      </div>
    </div>
  );
}

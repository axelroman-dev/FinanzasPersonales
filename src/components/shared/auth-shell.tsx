import { Wallet } from "lucide-react";

/**
 * Marco de las páginas sin sesión (login, recuperar contraseña…): el logo de
 * la app (la cartera, como en el menú y el icono del navegador) y el título
 */
export function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground mb-4">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Finanzas Personales</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

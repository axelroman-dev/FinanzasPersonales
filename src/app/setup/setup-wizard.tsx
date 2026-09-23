"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/setup-rules";

const STEPS = ["Código", "Administrador", "Registro"];

export function SetupWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [allowRegistration, setAllowRegistration] = useState(false);

  /** Devuelve null si salió bien, o el status y mensaje de error */
  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return { status: res.status, message: (data.error as string) || "Ocurrió un error" };
  }

  function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const err = await post("/api/setup/verify", { code });
      if (err) return setError(err.message);
      setStep(1);
    });
  }

  function onAdminData(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return setError(`La contraseña debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres`);
    }
    if (password !== confirmPassword) {
      return setError("Las contraseñas no coinciden");
    }
    setStep(2);
  }

  function onFinish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const err = await post("/api/setup", {
        code,
        name,
        email,
        password,
        allowRegistration,
      });
      if (err) {
        // El código ya no sirve (reinicio del servidor o se usó en otra pestaña)
        if (err.status === 401) {
          setCode("");
          setStep(0);
        }
        return setError(err.message);
      }
      router.replace("/login?setup=done");
    });
  }

  return (
    <div className="space-y-6">
      {/* Indicador de pasos */}
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
            <span className={i === step ? "font-medium text-foreground" : "text-muted-foreground"}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form onSubmit={onVerifyCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El código se muestra en los logs del servidor al arrancar. Con Docker:
          </p>
          <pre className="rounded-md bg-muted px-3 py-2 text-xs overflow-x-auto">
            docker compose logs app
          </pre>
          <div className="space-y-2">
            <Label htmlFor="code">Código de configuración</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              className="font-mono uppercase tracking-widest"
            />
          </div>
          <ErrorBox error={error} />
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continuar
          </Button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={onAdminData} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder={`Mínimo ${MIN_ADMIN_PASSWORD_LENGTH} caracteres`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="flex gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <p>
              <strong>Guarda bien esta contraseña.</strong> Es la cuenta con más
              permisos y la app no envía correos para recuperarla. Si la pierdes,
              solo se puede restablecer desde el servidor.
            </p>
          </div>

          <ErrorBox error={error} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
              Atrás
            </Button>
            <Button type="submit" className="flex-1">
              Continuar
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={onFinish} className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowRegistration" className="text-base">
                Permitir nuevos registros
              </Label>
              <p className="text-sm text-muted-foreground">
                Cualquier persona con acceso a la app podrá crear una cuenta.
                Puedes cambiarlo después en Configuración.
              </p>
            </div>
            <Switch
              id="allowRegistration"
              checked={allowRegistration}
              onCheckedChange={setAllowRegistration}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Si lo dejas desactivado, solo tú podrás crear cuentas desde el panel
            de administración.
          </p>

          <ErrorBox error={error} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isPending}>
              Atrás
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Crear administrador
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
      {error}
    </div>
  );
}

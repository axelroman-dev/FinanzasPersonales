"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Fields = { name: string; email: string; password: string };

/** Segundos que hay que esperar para pedir otro código (igual que el servidor) */
const RESEND_COOLDOWN_S = 60;

/**
 * Registro en dos pasos cuando hay correo configurado: datos → código de 6
 * dígitos enviado al correo. La cuenta se crea al confirmar el código. Sin
 * correo, el servidor crea la cuenta en el primer paso.
 */
export function RegisterForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Se conservan para volver al paso 1 y para iniciar sesión al final
  const [fields, setFields] = useState<Fields>({ name: "", email: "", password: "" });
  const [step, setStep] = useState<"form" | "code">("form");

  async function login(f: Fields) {
    await signIn("credentials", { email: f.email, password: f.password, redirect: false });
    router.push("/");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const data = new FormData(e.currentTarget);
    const next: Fields = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
    setFields(next);

    if (next.password !== data.get("confirm")) {
      setFormError("Las contraseñas no coinciden");
      return;
    }
    if (next.password.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error || "Error al crear la cuenta");
        return;
      }
      if (body.verify) {
        setStep("code");
        return;
      }
      // Sin correo configurado la cuenta ya está creada
      await login(next);
    } catch {
      setFormError("Error al crear la cuenta");
    } finally {
      setIsPending(false);
    }
  }

  if (step === "code") {
    return (
      <VerifyCode
        email={fields.email}
        onBack={() => {
          setFormError(null);
          setStep("form");
        }}
        onVerified={() => login(fields)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="Tu nombre"
          defaultValue={fields.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          defaultValue={fields.email}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          defaultValue={fields.password}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          defaultValue={fields.password}
        />
      </div>

      {formError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

/** Paso 2: escribir el código que llegó al correo */
function VerifyCode({
  email,
  onBack,
  onVerified,
}: {
  email: string;
  onBack: () => void;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(value: string) {
    setIsPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "No se pudo verificar el código");
        setCode("");
        setIsPending(false);
        return;
      }
      await onVerified();
    } catch {
      setError("No se pudo verificar el código");
      setIsPending(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "No se pudo reenviar el código");
      return;
    }
    setCode("");
    setNotice("Te enviamos un código nuevo.");
    setCooldown(RESEND_COOLDOWN_S);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) verify(code);
      }}
      className="space-y-4"
    >
      <div className="space-y-2 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <p className="text-sm">
          Te enviamos un código de 6 dígitos a{" "}
          <span className="font-medium">{email}</span>. Vence en 15 minutos.
        </p>
        <p className="text-xs text-muted-foreground">¿No llega? Revisa tu carpeta de spam.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            // Al completar los 6 dígitos se envía solo
            if (digits.length === 6 && !isPending) verify(digits);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          autoFocus
          className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && <p className="text-center text-sm text-primary">{notice}</p>}

      <Button type="submit" disabled={isPending || code.length !== 6} className="w-full">
        {isPending ? "Verificando..." : "Confirmar y crear cuenta"}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          Cambiar datos
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Reenviar código (${cooldown}s)` : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}

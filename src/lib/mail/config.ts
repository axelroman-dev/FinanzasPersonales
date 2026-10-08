/**
 * Configuración del correo desde el .env. Sin SMTP_HOST el correo está
 * desactivado y la app funciona sin enviar nada (p. ej. invitaciones →
 * contraseña temporal).
 *
 *   SMTP_HOST=smtp.hostinger.com
 *   SMTP_PORT=465                 # 465 = SSL; 587 = STARTTLS
 *   SMTP_USER=finanzas@tudominio.com
 *   SMTP_PASSWORD=...
 *   MAIL_FROM="Finanzas Personales <finanzas@tudominio.com>"   # opcional: por defecto SMTP_USER
 */
export type MailConfig = {
  host: string;
  port: number;
  /** TLS directo (puerto 465); en otro puerto se usa STARTTLS si el servidor lo ofrece */
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
};

export function getMailConfig(
  env: Record<string, string | undefined> = process.env
): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT) || 465;
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  // Sin usuario (p. ej. Mailpit en desarrollo) se envía sin autenticar
  const auth = user && pass ? { user, pass } : undefined;
  const from =
    env.MAIL_FROM?.trim() ||
    (user ? `Finanzas Personales <${user}>` : "Finanzas Personales <finanzas@localhost>");
  return { host, port, secure: port === 465, auth, from };
}

export function mailEnabled(): boolean {
  return getMailConfig() !== null;
}

/** URL pública de la app, para los enlaces de los correos */
export function appUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

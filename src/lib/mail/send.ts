import nodemailer, { type Transporter } from "nodemailer";
import { getMailConfig } from "./config";
import type { RenderedEmail } from "./templates";

let transport: Transporter | null = null;
let transportKey = "";

function getTransport(): Transporter | null {
  const config = getMailConfig();
  if (!config) return null;
  // Se rehace si cambia la configuración (p. ej. en tests)
  const key = JSON.stringify(config);
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Que un SMTP caído no deje colgada la petición
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transportKey = key;
  }
  return transport;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Envía un correo. No lanza: devuelve { ok: false } si el correo está
 * desactivado o falla, para que quien llama decida si es grave.
 */
export async function sendMail(to: string, email: RenderedEmail): Promise<SendResult> {
  const config = getMailConfig();
  const t = getTransport();
  if (!config || !t) return { ok: false, error: "El correo no está configurado" };
  try {
    await t.sendMail({ from: config.from, to, subject: email.subject, html: email.html, text: email.text });
    return { ok: true };
  } catch (error) {
    console.error(`No se pudo enviar el correo «${email.subject}» a ${to}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Error al enviar" };
  }
}

/** Revisa la conexión y las credenciales SMTP (al arrancar) */
export async function verifyMail(): Promise<SendResult> {
  const t = getTransport();
  if (!t) return { ok: false, error: "El correo no está configurado" };
  try {
    await t.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error al conectar" };
  }
}

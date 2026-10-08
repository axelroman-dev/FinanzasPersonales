/**
 * Plantillas de correo: HTML con estilos en línea (los clientes de correo
 * ignoran <style> y CSS moderno) y versión en texto plano. Fondo claro: muchos
 * clientes no respetan un tema oscuro.
 */
export type RenderedEmail = { subject: string; html: string; text: string };

const BRAND = "#16a34a";

/** Escapa texto del usuario (nombres, etc.) para meterlo en el HTML */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Block = { kind: "p"; text: string } | { kind: "small"; text: string };

/** Arma el correo: saludo, párrafos, botón opcional y pie */
function layout(params: {
  subject: string;
  /** Texto que algunos clientes muestran junto al asunto */
  preheader: string;
  greeting: string;
  blocks: Block[];
  button?: { label: string; url: string };
  /** Bajo el botón: el enlace por si el botón no funciona */
  showLink?: boolean;
  /** Nota pequeña al final (p. ej. «si no lo pediste, ignóralo») */
  footnote?: string;
}): RenderedEmail {
  const { subject, preheader, greeting, blocks, button, showLink = true, footnote } = params;

  const body = blocks
    .map((b) =>
      b.kind === "p"
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#27272a;">${escapeHtml(b.text)}</p>`
        : `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;">${escapeHtml(b.text)}</p>`
    )
    .join("");

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${BRAND};">
<a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(button.label)}</a>
</td></tr></table>` +
      (showLink
        ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${escapeHtml(button.url)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(button.url)}</a></p>`
        : "")
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
<tr><td style="padding:24px 28px 8px;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:${BRAND};color:#fff;font-weight:700;font-size:15px;">F</span>
<span style="margin-left:8px;font-size:16px;font-weight:700;color:#18181b;vertical-align:middle;">Finanzas</span></td></tr>
<tr><td style="padding:16px 28px 8px;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#27272a;">${escapeHtml(greeting)}</p>
${body}${buttonHtml}${footnote ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#71717a;">${escapeHtml(footnote)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #f4f4f5;font-size:12px;line-height:1.5;color:#a1a1aa;">Este correo lo envió automáticamente tu app de Finanzas. No respondas a este mensaje.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    greeting,
    "",
    ...blocks.map((b) => b.text),
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    ...(footnote ? ["", footnote] : []),
    "",
    "— Finanzas (correo automático, no respondas a este mensaje)",
  ].join("\n");

  return { subject, html, text };
}

const greet = (name: string) => `Hola, ${name.split(" ")[0] || name}:`;

const dateTimeLabel = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Enlace para poner una contraseña nueva (¿Olvidaste tu contraseña?) */
export function passwordResetEmail(params: {
  name: string;
  url: string;
  expiresInMinutes: number;
}): RenderedEmail {
  return layout({
    subject: "Restablece tu contraseña",
    preheader: "Usa este enlace para crear una contraseña nueva.",
    greeting: greet(params.name),
    blocks: [
      { kind: "p", text: "Recibimos una solicitud para restablecer la contraseña de tu cuenta." },
      {
        kind: "p",
        text: `Usa el botón para crear una nueva. El enlace vence en ${params.expiresInMinutes} minutos y solo se puede usar una vez.`,
      },
    ],
    button: { label: "Crear contraseña nueva", url: params.url },
    footnote: "Si no lo pediste tú, ignora este correo: tu contraseña no cambia.",
  });
}

/** Aviso de seguridad tras cambiar o restablecer la contraseña */
export function passwordChangedEmail(params: {
  name: string;
  when: Date;
  /** Para recuperar el acceso si no fue el usuario */
  forgotUrl: string;
  how: "changed" | "reset";
}): RenderedEmail {
  return layout({
    subject: "Tu contraseña cambió",
    preheader: "Si no fuiste tú, restablécela ahora.",
    greeting: greet(params.name),
    blocks: [
      {
        kind: "p",
        // La hora termina en «p.m.»: la frase no acaba en ella para no repetir el punto
        text: `La contraseña de tu cuenta se ${params.how === "reset" ? "restableció" : "cambió"} el ${dateTimeLabel.format(params.when)} y se cerraron las sesiones abiertas en otros dispositivos.`,
      },
      { kind: "p", text: "Si fuiste tú, no tienes que hacer nada." },
      { kind: "p", text: "Si no fuiste tú, restablece tu contraseña ahora:" },
    ],
    button: { label: "Restablecer contraseña", url: params.forgotUrl },
    showLink: false,
  });
}

/** Correo de prueba desde Admin › Configuración */
export function testEmail(params: { name: string }): RenderedEmail {
  return layout({
    subject: "Correo de prueba",
    preheader: "La configuración de correo funciona.",
    greeting: greet(params.name),
    blocks: [
      { kind: "p", text: "Si lees esto, la configuración de correo de tu app de Finanzas funciona." },
      {
        kind: "small",
        text: "Si este correo llegó a spam, revisa los registros SPF, DKIM y DMARC de tu dominio.",
      },
    ],
  });
}

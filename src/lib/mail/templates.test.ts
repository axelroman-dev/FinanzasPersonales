import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  inviteEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationCodeEmail,
} from "./templates";
import { getMailConfig } from "./config";

describe("plantillas", () => {
  it("escapa el nombre del usuario en el HTML", () => {
    const email = passwordResetEmail({
      name: "<script>x</script>",
      url: "https://app.test/reset-password?token=abc",
      expiresInMinutes: 60,
    });
    expect(email.html).not.toContain("<script>x");
    expect(email.html).toContain(escapeHtml("<script>x</script>"));
  });

  it("incluye el enlace en el HTML y en el texto", () => {
    const url = "https://app.test/reset-password?token=abc&x=1";
    const email = passwordResetEmail({ name: "Ana López", url, expiresInMinutes: 60 });
    expect(email.subject).toBe("Restablece tu contraseña");
    expect(email.html).toContain(escapeHtml(url));
    expect(email.text).toContain(url);
    expect(email.text).toContain("Hola, Ana:");
  });

  it("el aviso de cambio dice si se cambió o se restableció", () => {
    const base = { name: "Ana", when: new Date(2026, 9, 8, 10, 30), forgotUrl: "https://app.test/forgot-password" };
    expect(passwordChangedEmail({ ...base, how: "reset" }).text).toContain("se restableció");
    expect(passwordChangedEmail({ ...base, how: "changed" }).text).toContain("se cambió");
  });
});

describe("invitación", () => {
  it("dice quién invita, con qué correo se entra y lleva el enlace", () => {
    const url = "https://app.test/invite?token=abc";
    const email = inviteEmail({
      name: "Ana López",
      inviterName: "Axel",
      email: "ana@x.mx",
      url,
      expiresInDays: 7,
    });
    expect(email.subject).toBe("Te invitaron a Finanzas Personales");
    expect(email.text).toContain("Axel te creó una cuenta");
    expect(email.text).toContain("ana@x.mx");
    expect(email.text).toContain(url);
  });
});

describe("código de verificación", () => {
  it("lleva el código en el asunto, el HTML y el texto", () => {
    const email = verificationCodeEmail({ name: "Ana", code: "042917", expiresInMinutes: 15 });
    expect(email.subject).toBe("042917 es tu código de Finanzas Personales");
    expect(email.html).toContain("042917");
    expect(email.text).toContain("042917");
    expect(email.text).toContain("15 minutos");
  });
});

describe("getMailConfig", () => {
  it("sin SMTP_HOST el correo está desactivado", () => {
    expect(getMailConfig({})).toBeNull();
  });

  it("465 usa TLS directo y el remitente por defecto es el usuario", () => {
    expect(
      getMailConfig({ SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "a@b.mx", SMTP_PASSWORD: "x" })
    ).toEqual({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true,
      auth: { user: "a@b.mx", pass: "x" },
      from: "Finanzas Personales <a@b.mx>",
    });
  });

  it("587 usa STARTTLS; sin usuario no autentica", () => {
    const c = getMailConfig({ SMTP_HOST: "localhost", SMTP_PORT: "587", MAIL_FROM: "X <x@y.z>" });
    expect(c).toMatchObject({ port: 587, secure: false, auth: undefined, from: "X <x@y.z>" });
  });
});

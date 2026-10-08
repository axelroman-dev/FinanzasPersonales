/**
 * Hook de arranque de Next.js: crea o sincroniza el admin del sistema con la
 * contraseña de ADMIN_PASSWORD (ver src/lib/system-admin.ts) y arranca los
 * cobros automáticos de suscripciones.
 */
export async function register() {
  // El import va dentro del if para que no se incluya en el bundle edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSystemAdmin, getAdminPassword } = await import(
      "@/lib/system-admin"
    );
    // Sin ADMIN_PASSWORD válida no hay forma de entrar: no arrancar
    const password = getAdminPassword();

    // ATTACHMENTS_KEY es opcional (sin ella no hay adjuntos), pero si está mal
    // escrita mejor no arrancar que guardar archivos que no se podrán leer
    const { getAttachmentsKey } = await import("@/lib/storage/crypto");
    if (!getAttachmentsKey()) {
      console.log("ℹ️  Adjuntos desactivados: define ATTACHMENTS_KEY para activarlos");
    }
    try {
      await ensureSystemAdmin(password);
    } catch (error) {
      // Sin DB no se puede verificar; no impedir que el servidor arranque
      console.error("No se pudo preparar el admin del sistema:", error);
    }

    // Correo: solo informa; sin SMTP la app funciona con el correo desactivado
    const { getMailConfig } = await import("@/lib/mail/config");
    const mail = getMailConfig();
    if (!mail) {
      console.log("ℹ️  Correo desactivado: define SMTP_HOST (y SMTP_*) para activarlo");
    } else {
      const { verifyMail } = await import("@/lib/mail/send");
      void verifyMail().then((r) =>
        r.ok
          ? console.log(`✉️  Correo listo (${mail.host}:${mail.port})`)
          : console.error(`⚠️  No se pudo conectar al correo (${mail.host}:${mail.port}): ${r.error}`)
      );
    }

    // Cobros automáticos de suscripciones: al arrancar y cada hora
    const { startSubscriptionScheduler } = await import("@/lib/subscription-charges");
    startSubscriptionScheduler();
  }
}

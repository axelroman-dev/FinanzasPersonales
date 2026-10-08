import { appUrl, mailEnabled } from "./config";
import { sendMail } from "./send";
import { passwordChangedEmail } from "./templates";

/**
 * Aviso de seguridad tras cambiar o restablecer la contraseña. Se manda en
 * segundo plano: un SMTP lento no debe frenar la respuesta al usuario.
 */
export function notifyPasswordChanged(
  user: { name: string; email: string },
  how: "changed" | "reset"
) {
  if (!mailEnabled()) return;
  void sendMail(
    user.email,
    passwordChangedEmail({
      name: user.name,
      when: new Date(),
      forgotUrl: `${appUrl()}/forgot-password`,
      how,
    })
  );
}

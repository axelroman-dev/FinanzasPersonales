import { TOKEN_TTL_MS, issueAuthToken } from "@/lib/auth-tokens";
import { appUrl } from "./config";
import { sendMail, type SendResult } from "./send";
import { inviteEmail, passwordResetEmail } from "./templates";

type Recipient = { id: string; name: string; email: string };

/** Crea un enlace de invitación (anula los anteriores) y lo manda por correo */
export async function sendInvite(user: Recipient, inviterName: string): Promise<SendResult> {
  const token = await issueAuthToken(user.id, "INVITE");
  return sendMail(
    user.email,
    inviteEmail({
      name: user.name,
      inviterName,
      email: user.email,
      url: `${appUrl()}/invite?token=${token}`,
      expiresInDays: TOKEN_TTL_MS.INVITE / 86_400_000,
    })
  );
}

/** Crea un enlace para restablecer la contraseña y lo manda por correo */
export async function sendPasswordResetLink(user: Recipient): Promise<SendResult> {
  const token = await issueAuthToken(user.id, "PASSWORD_RESET");
  return sendMail(
    user.email,
    passwordResetEmail({
      name: user.name,
      url: `${appUrl()}/reset-password?token=${token}`,
      expiresInMinutes: TOKEN_TTL_MS.PASSWORD_RESET / 60_000,
    })
  );
}

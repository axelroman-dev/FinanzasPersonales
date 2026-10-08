import { AuthShell } from "@/components/shared/auth-shell";
import { findValidAuthToken } from "@/lib/auth-tokens";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const invite = await findValidAuthToken(token, "INVITE");

  return (
    <AuthShell subtitle={invite ? "Crea tu contraseña" : "Invitación"}>
      {invite && invite.user.isActive ? (
        <AcceptInviteForm
          token={token}
          name={invite.user.name}
          email={invite.user.email}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Esta invitación no es válida o ya venció (duran 7 días y solo se pueden usar una
          vez). Pide al administrador que te la reenvíe.
        </p>
      )}
    </AuthShell>
  );
}

import { signOut } from "@/auth";

/**
 * Cierra la sesión de un usuario desactivado/eliminado y lo manda a /login.
 * Lo usa requireUser() cuando la cookie del JWT sigue siendo válida pero el
 * usuario ya no puede entrar.
 */
export async function GET() {
  await signOut({ redirectTo: "/login?error=inactive" });
}

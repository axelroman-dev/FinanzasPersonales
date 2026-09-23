import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

/**
 * Ruta que cierra la sesión (borra la cookie del JWT) y manda a /login.
 * Se usa cuando la sesión es válida pero el usuario ya no puede entrar.
 */
export const SESSION_EXPIRED_PATH = "/session-expired";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  mustChangePassword: boolean;
};

/**
 * Usuario de la sesión actual, o null si no hay sesión o si el usuario fue
 * desactivado/eliminado. El JWT no se invalida cuando un admin cambia al
 * usuario, así que `isActive` y `role` se leen de la DB en cada request
 * (`cache` evita repetir la consulta dentro del mismo request).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as any;

  const dbUser = await prisma.user.findUnique({
    where: { id: u.id },
    select: { isActive: true, role: true },
  });
  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: u.id,
    email: u.email!,
    name: u.name!,
    role: dbUser.role,
    mustChangePassword: u.mustChangePassword ?? false,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  // Si hay cookie de sesión pero el usuario ya no es válido, redirigir a /login
  // directo haría un loop (el middleware manda a los logueados de vuelta a "/"),
  // así que primero se cierra la sesión.
  if (!user) redirect(SESSION_EXPIRED_PATH);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
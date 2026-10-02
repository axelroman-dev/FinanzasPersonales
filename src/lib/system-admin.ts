import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { seedDefaultCategories } from "@/lib/categories";

/**
 * Administrador del sistema: una cuenta fija que se crea al arrancar el
 * servidor. Su email y nombre no se pueden modificar y su contraseña viene de
 * ADMIN_PASSWORD en el .env, que es la fuente de verdad: en cada arranque se
 * sincroniza. Para cambiarla se edita el .env y se reinicia.
 */

export const SYSTEM_ADMIN_EMAIL = "admin@finanzas.local";
export const SYSTEM_ADMIN_NAME = "admin";
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export function isSystemAdmin(user: { email: string }): boolean {
  return user.email.toLowerCase() === SYSTEM_ADMIN_EMAIL;
}

/** Lee ADMIN_PASSWORD; lanza un error si falta o es demasiado corta. */
export function getAdminPassword(
  env: Record<string, string | undefined> = process.env
): string {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "Falta ADMIN_PASSWORD en el .env: es la contraseña de " +
        `${SYSTEM_ADMIN_EMAIL} y es obligatoria.`
    );
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`
    );
  }
  return password;
}

/**
 * Se llama al arrancar el servidor (src/instrumentation.ts). Crea el admin si
 * no existe; si existe, restaura sus datos fijos y sincroniza la contraseña.
 */
export async function ensureSystemAdmin(password: string): Promise<void> {
  const fixed = {
    name: SYSTEM_ADMIN_NAME,
    role: "ADMIN" as const,
    isActive: true,
    mustChangePassword: false,
  };
  const existing = await prisma.user.findUnique({
    where: { email: SYSTEM_ADMIN_EMAIL },
  });

  if (!existing) {
    const admin = await prisma.user.create({
      data: {
        ...fixed,
        email: SYSTEM_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    await seedDefaultCategories(admin.id);
    console.log(`✅ Admin creado: ${SYSTEM_ADMIN_EMAIL}`);
    return;
  }

  const passwordChanged = !(await bcrypt.compare(password, existing.passwordHash));
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...fixed,
      ...(passwordChanged && { passwordHash: await bcrypt.hash(password, 10) }),
    },
  });
  if (passwordChanged) {
    console.log(`🔑 Contraseña de ${SYSTEM_ADMIN_EMAIL} actualizada desde .env`);
  }
}

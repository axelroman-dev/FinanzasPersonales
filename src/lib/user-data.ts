import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { seedDefaultCategories } from "@/lib/categories";
import { deleteUserFiles } from "@/lib/attachments";

/**
 * Acciones irreversibles sobre los datos del propio usuario (zona de peligro
 * del perfil). Ambas se confirman con la contraseña actual.
 */

export async function passwordMatches(
  userId: string,
  password: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return !!user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
}

/**
 * Borra cuentas, movimientos, suscripciones y categorías del usuario y vuelve
 * a crear las categorías predeterminadas. La cuenta de usuario se conserva.
 */
export async function clearUserData(userId: string): Promise<void> {
  // Orden por las relaciones: los movimientos referencian cuentas,
  // suscripciones y categorías; las suscripciones, cuentas
  await prisma.$transaction([
    // Los registros de adjuntos se borran en cascada con los movimientos
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.category.deleteMany({ where: { userId } }),
  ]);
  await deleteUserFiles(userId);
  await seedDefaultCategories(userId);
}

/** Elimina al usuario; sus datos se borran en cascada */
export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
  await deleteUserFiles(userId);
}

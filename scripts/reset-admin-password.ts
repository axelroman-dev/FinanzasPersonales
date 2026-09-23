/**
 * Restablece la contraseña de un administrador que la perdió. Genera una
 * contraseña temporal y obliga a cambiarla al iniciar sesión.
 *
 * Solo lo puede correr quien tiene acceso al servidor.
 *
 * Uso:
 *   npx tsx scripts/reset-admin-password.ts [email]
 *
 * En Docker:
 *   docker compose exec app npx tsx scripts/reset-admin-password.ts [email]
 *
 * Sin email, funciona si hay un solo admin; si hay varios, los lista.
 */
import { randomInt } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", ...(email ? { email } : {}) },
    select: { id: true, email: true },
  });

  if (admins.length === 0) {
    console.error(
      email
        ? `No existe un admin con el email ${email}.`
        : "No hay administradores. Reinicia el servidor y usa el código de configuración inicial."
    );
    process.exit(1);
  }
  if (admins.length > 1) {
    console.error("Hay varios administradores, indica cuál:");
    for (const a of admins) console.error(`  ${a.email}`);
    process.exit(1);
  }

  const admin = admins[0];
  const tempPassword = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
      isActive: true,
    },
  });

  console.log(`Contraseña temporal para ${admin.email}: ${tempPassword}`);
  console.log("Se pedirá cambiarla al iniciar sesión.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

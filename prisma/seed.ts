import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. AppConfig singleton
  const adminEmail = process.env.ADMIN_EMAIL || "admin@finanzas.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const adminName = process.env.ADMIN_NAME || "Administrador";

  // 2. Crear admin si no existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  let admin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log(`✅ Admin creado: ${admin.email} / ${adminPassword}`);
  } else {
    admin = existingAdmin;
    console.log(`ℹ️  Admin ya existe: ${admin.email}`);
  }

  // 3. Crear/actualizar AppConfig
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: { updatedById: admin.id },
    create: {
      id: "singleton",
      allowRegistration: true,
      updatedById: admin.id,
    },
  });
  console.log("✅ AppConfig inicializado");

  console.log("🎉 Seed completado");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

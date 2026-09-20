import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { defaultCategories } from "./default-categories";

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

  // 3. Crear categorías default para el admin si no tiene
  const adminCatCount = await prisma.category.count({
    where: { userId: admin.id },
  });
  if (adminCatCount === 0) {
    for (const cat of defaultCategories) {
      const parent = await prisma.category.create({
        data: {
          userId: admin.id,
          name: cat.name,
          kind: cat.kind,
          color: cat.color,
          icon: cat.icon,
          parentId: null,
        },
      });
      if (cat.children) {
        for (const child of cat.children) {
          await prisma.category.create({
            data: {
              userId: admin.id,
              name: child.name,
              kind: cat.kind,
              color: child.color ?? cat.color,
              icon: child.icon ?? cat.icon,
              parentId: parent.id,
            },
          });
        }
      }
    }
    console.log("✅ Categorías predeterminadas creadas para el admin");
  }

  // 4. Crear/actualizar AppConfig
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

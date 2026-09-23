import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed idempotente. El admin ya no se crea aquí: se crea desde el asistente
 * de configuración inicial (/setup) con el código que aparece en los logs.
 */
async function main() {
  console.log("🌱 Seeding database...");

  // AppConfig singleton (registro desactivado por defecto)
  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", allowRegistration: false },
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

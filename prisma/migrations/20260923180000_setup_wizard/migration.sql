-- Configuración inicial con código en los logs (reemplaza ADMIN_EMAIL/ADMIN_PASSWORD)
ALTER TABLE "AppConfig" ADD COLUMN "setupCodeHash" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "setupAttempts" INTEGER NOT NULL DEFAULT 0;

-- El registro público queda desactivado por defecto en instalaciones nuevas
-- (las existentes conservan su valor)
ALTER TABLE "AppConfig" ALTER COLUMN "allowRegistration" SET DEFAULT false;

-- Proveedor de tipos de cambio por usuario y configuración inicial
ALTER TABLE "User" ADD COLUMN "ratesProvider" TEXT NOT NULL DEFAULT 'ECB';
ALTER TABLE "User" ADD COLUMN "ratesProviderUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "banxicoToken" TEXT;
ALTER TABLE "User" ADD COLUMN "manualRates" JSONB;
ALTER TABLE "User" ADD COLUMN "manualRatesAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Los usuarios existentes ya usan la app: no ven la configuración inicial
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;

-- La caché ahora va por proveedor; lo guardado hasta hoy es del BCE
ALTER TABLE "ExchangeRate" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'ECB';
ALTER TABLE "ExchangeRate" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "ExchangeRate" DROP CONSTRAINT "ExchangeRate_pkey";
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("provider", "base", "quote");

-- Moneda principal y secundarias por usuario, y caché de tipos de cambio
ALTER TABLE "User" ADD COLUMN "primaryCurrency" TEXT NOT NULL DEFAULT 'MXN';
ALTER TABLE "User" ADD COLUMN "secondaryCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Las cuentas existentes en otra moneda siguen siendo válidas: su moneda pasa
-- a ser secundaria del usuario
UPDATE "User" u SET "secondaryCurrencies" = sub.currencies
FROM (
    SELECT "userId", array_agg(DISTINCT "currency" ORDER BY "currency") AS currencies
    FROM "Account"
    WHERE "currency" <> 'MXN'
    GROUP BY "userId"
) sub
WHERE sub."userId" = u."id";

CREATE TABLE "ExchangeRate" (
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("base","quote")
);

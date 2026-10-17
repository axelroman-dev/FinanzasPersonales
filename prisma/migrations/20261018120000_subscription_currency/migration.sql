-- Moneda propia de cada suscripción; las existentes usan la de su cuenta
ALTER TABLE "Subscription" ADD COLUMN "currency" TEXT;
UPDATE "Subscription" s SET "currency" = a."currency"
FROM "Account" a
WHERE a."id" = s."accountId";
ALTER TABLE "Subscription" ALTER COLUMN "currency" SET NOT NULL;

-- Cobros convertidos de otra moneda: monto original y tasa usada
ALTER TABLE "Transaction" ADD COLUMN "originalAmount" DECIMAL(14,2);
ALTER TABLE "Transaction" ADD COLUMN "originalCurrency" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "exchangeRate" DECIMAL(18,8);

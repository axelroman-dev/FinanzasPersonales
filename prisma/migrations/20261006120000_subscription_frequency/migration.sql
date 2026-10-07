-- Suscripciones mensuales o anuales que se cobran solas. Las existentes
-- quedan mensuales y con nextChargeAt en NULL: la app calcula su próximo
-- cobro desde el día en que se despliega, sin cobrar fechas pasadas.

CREATE TYPE "SubscriptionFrequency" AS ENUM ('MONTHLY', 'YEARLY');

ALTER TABLE "Subscription"
  ADD COLUMN "frequency" "SubscriptionFrequency" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "billingMonth" INTEGER,
  ADD COLUMN "nextChargeAt" TIMESTAMP(3);

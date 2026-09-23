-- Los movimientos existentes se aplicaron con la regla anterior (1): en tarjetas
-- de crédito, los ingresos y transferencias entrantes aumentaban la deuda.
-- Los nuevos usan la regla actual (2). Ver src/lib/transaction-balance.ts.
ALTER TABLE "Transaction" ADD COLUMN "balanceRule" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Transaction" ALTER COLUMN "balanceRule" SET DEFAULT 2;

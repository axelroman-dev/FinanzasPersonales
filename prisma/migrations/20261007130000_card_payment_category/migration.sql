-- Pago de tarjeta: las transferencias de una cuenta que no es de crédito a
-- una tarjeta de crédito llevan la categoría interna "Tarjetas de crédito ›
-- Pago de tarjeta" (ver src/lib/internal-categories.ts). Se crea solo para
-- los usuarios que ya tienen alguna.

-- Raíz interna (el índice único no aplica con parentId NULL: se evita duplicar)
INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "color", "icon", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."userId", 'Tarjetas de crédito', NULL, 'INTERNAL', '#60a5fa', 'credit-card', NOW(), NOW()
FROM (
  SELECT DISTINCT t."userId"
  FROM "Transaction" t
  JOIN "Account" a ON a."id" = t."accountId"
  JOIN "Account" d ON d."id" = t."transferAccountId"
  WHERE t."type" = 'TRANSFER' AND d."type" = 'CREDIT' AND a."type" <> 'CREDIT'
) u
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c
  WHERE c."userId" = u."userId" AND c."kind" = 'INTERNAL'
    AND c."parentId" IS NULL AND c."name" = 'Tarjetas de crédito'
);

INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "color", "icon", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."userId", 'Pago de tarjeta', r."id", 'INTERNAL', r."color", 'credit-card', NOW(), NOW()
FROM "Category" r
WHERE r."kind" = 'INTERNAL' AND r."parentId" IS NULL AND r."name" = 'Tarjetas de crédito'
ON CONFLICT ("userId", "name", "parentId") DO NOTHING;

UPDATE "Transaction" t SET "categoryId" = c."id"
FROM "Account" a, "Account" d, "Category" c, "Category" r
WHERE a."id" = t."accountId"
  AND d."id" = t."transferAccountId"
  AND t."type" = 'TRANSFER' AND d."type" = 'CREDIT' AND a."type" <> 'CREDIT'
  AND r."userId" = t."userId" AND r."kind" = 'INTERNAL'
  AND r."parentId" IS NULL AND r."name" = 'Tarjetas de crédito'
  AND c."parentId" = r."id" AND c."name" = 'Pago de tarjeta';

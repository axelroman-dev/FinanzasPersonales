-- La categoría de una suscripción era texto libre; ahora referencia una
-- categoría de gasto del usuario. El texto se resuelve por nombre entre sus
-- categorías de gasto (sin distinguir mayúsculas), prefiriendo las
-- principales. Si no hay ninguna con ese nombre, se crea como categoría
-- principal de gasto para no perder el dato.

ALTER TABLE "Subscription" ADD COLUMN "categoryId" TEXT;

INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, m."userId", m."name", NULL, 'EXPENSE', NOW(), NOW()
FROM (
  SELECT DISTINCT ON (s."userId", lower(trim(s."category")))
    s."userId", trim(s."category") AS "name"
  FROM "Subscription" s
  WHERE s."category" IS NOT NULL
    AND trim(s."category") <> ''
    AND NOT EXISTS (
      SELECT 1 FROM "Category" c
      WHERE c."userId" = s."userId"
        AND c."kind" = 'EXPENSE'
        AND lower(trim(c."name")) = lower(trim(s."category"))
    )
  ORDER BY s."userId", lower(trim(s."category")), s."createdAt"
) m;

UPDATE "Subscription" s
SET "categoryId" = (
  SELECT c."id"
  FROM "Category" c
  WHERE c."userId" = s."userId"
    AND c."kind" = 'EXPENSE'
    AND lower(trim(c."name")) = lower(trim(s."category"))
  ORDER BY (c."parentId" IS NULL) DESC, c."createdAt"
  LIMIT 1
)
WHERE s."category" IS NOT NULL AND trim(s."category") <> '';

ALTER TABLE "Subscription" DROP COLUMN "category";

CREATE INDEX "Subscription_categoryId_idx" ON "Subscription"("categoryId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

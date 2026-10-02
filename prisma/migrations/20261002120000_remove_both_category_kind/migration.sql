-- Se quita el tipo de categoría BOTH ("Ambos"): una categoría es de gasto o de
-- ingreso. Las categorías BOTH pasan a EXPENSE; si tenían movimientos de
-- ingreso (en ellas o en sus subcategorías), se crea una copia de tipo INCOME
-- llamada "<nombre> (ingresos)", con las mismas subcategorías, y esos
-- movimientos se mueven ahí.

-- 1. Raíces BOTH con ingresos
CREATE TEMP TABLE "_split_roots" AS
SELECT c."id" AS "oldId", gen_random_uuid()::text AS "newId"
FROM "Category" c
WHERE c."kind" = 'BOTH'
  AND c."parentId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Transaction" t
    JOIN "Category" x ON x."id" = t."categoryId"
    WHERE t."type" = 'INCOME' AND (x."id" = c."id" OR x."parentId" = c."id")
  );

INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "color", "icon", "createdAt", "updatedAt")
SELECT s."newId", c."userId", c."name" || ' (ingresos)', NULL, 'INCOME', c."color", c."icon", NOW(), NOW()
FROM "_split_roots" s
JOIN "Category" c ON c."id" = s."oldId";

-- 2. Copia de sus subcategorías
CREATE TEMP TABLE "_split_children" AS
SELECT ch."id" AS "oldId", gen_random_uuid()::text AS "newId", s."newId" AS "newParentId"
FROM "_split_roots" s
JOIN "Category" ch ON ch."parentId" = s."oldId";

INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "color", "icon", "createdAt", "updatedAt")
SELECT sc."newId", ch."userId", ch."name", sc."newParentId", 'INCOME', ch."color", ch."icon", NOW(), NOW()
FROM "_split_children" sc
JOIN "Category" ch ON ch."id" = sc."oldId";

-- 3. Mover los movimientos de ingreso a las copias
UPDATE "Transaction" t
SET "categoryId" = s."newId"
FROM "_split_roots" s
WHERE t."categoryId" = s."oldId" AND t."type" = 'INCOME';

UPDATE "Transaction" t
SET "categoryId" = sc."newId"
FROM "_split_children" sc
WHERE t."categoryId" = sc."oldId" AND t."type" = 'INCOME';

-- 4. El resto de BOTH pasa a EXPENSE
UPDATE "Category" SET "kind" = 'EXPENSE' WHERE "kind" = 'BOTH';

DROP TABLE "_split_children";
DROP TABLE "_split_roots";

-- 5. Recrear el enum sin BOTH
ALTER TYPE "CategoryKind" RENAME TO "CategoryKind_old";
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE', 'INTERNAL');
ALTER TABLE "Category" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Category" ALTER COLUMN "kind" TYPE "CategoryKind" USING ("kind"::text::"CategoryKind");
ALTER TABLE "Category" ALTER COLUMN "kind" SET DEFAULT 'EXPENSE';
DROP TYPE "CategoryKind_old";

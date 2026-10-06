-- Categorías: iconos de Tabler, subcategorías con el color de su principal y
-- principales que solo agrupan (los movimientos van a una subcategoría).

-- Iconos: los nombres de lucide pasan a su equivalente en Tabler; los que no
-- tienen equivalente se quedan sin icono (se muestra el genérico)
UPDATE "Category" SET "icon" = CASE "icon"
  WHEN 'Utensils' THEN 'tools-kitchen-2'
  WHEN 'Car' THEN 'car'
  WHEN 'Home' THEN 'home'
  WHEN 'Film' THEN 'movie'
  WHEN 'Heart' THEN 'heartbeat'
  WHEN 'ShoppingBag' THEN 'shopping-bag'
  WHEN 'GraduationCap' THEN 'school'
  WHEN 'Receipt' THEN 'receipt'
  WHEN 'Briefcase' THEN 'briefcase'
  WHEN 'TrendingUp' THEN 'trending-up'
  WHEN 'Circle' THEN 'dots'
  WHEN 'SlidersHorizontal' THEN 'adjustments-horizontal'
  ELSE NULL
END
WHERE "icon" IS NOT NULL;

-- Subcategorías predeterminadas: icono propio en lugar del de su principal
UPDATE "Category" c SET "icon" = v."icon"
FROM (VALUES
  ('Alimentación', 'Supermercado', 'shopping-cart'),
  ('Alimentación', 'Restaurantes', 'chef-hat'),
  ('Alimentación', 'Comida rápida', 'burger'),
  ('Alimentación', 'Café', 'coffee'),
  ('Transporte', 'Gasolina', 'gas-station'),
  ('Transporte', 'Uber/Taxi', 'car-suv'),
  ('Transporte', 'Transporte público', 'bus'),
  ('Transporte', 'Mantenimiento', 'tool'),
  ('Vivienda', 'Renta', 'key'),
  ('Vivienda', 'Servicios', 'bulb'),
  ('Vivienda', 'Internet', 'wifi'),
  ('Vivienda', 'Mantenimiento', 'hammer'),
  ('Entretenimiento', 'Streaming', 'device-tv'),
  ('Entretenimiento', 'Salidas', 'confetti'),
  ('Entretenimiento', 'Hobbies', 'palette'),
  ('Salud', 'Médico', 'stethoscope'),
  ('Salud', 'Farmacia', 'pill'),
  ('Salud', 'Gimnasio', 'barbell'),
  ('Compras', 'Ropa', 'shirt'),
  ('Compras', 'Tecnología', 'device-laptop'),
  ('Compras', 'Hogar', 'sofa'),
  ('Compras', 'Otros', 'package'),
  ('Servicios', 'Teléfono', 'device-mobile'),
  ('Servicios', 'Seguros', 'shield-check'),
  ('Servicios', 'Bancos', 'building-bank'),
  ('Ingresos extra', 'Freelance', 'device-laptop'),
  ('Ingresos extra', 'Ventas', 'tag'),
  ('Ingresos extra', 'Regalos', 'gift'),
  ('Ingresos extra', 'Inversiones', 'chart-line')
) AS v("parent", "name", "icon"), "Category" p
WHERE c."parentId" = p."id"
  AND p."name" = v."parent"
  AND c."name" = v."name";

-- Las subcategorías usan el color de su principal
UPDATE "Category" c SET "color" = p."color"
FROM "Category" p
WHERE c."parentId" = p."id";

-- Principales sin subcategorías o con movimientos/suscripciones asignados
-- directo: se les crea "General" para que sigan siendo utilizables
INSERT INTO "Category" ("id", "userId", "name", "parentId", "kind", "color", "icon", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."userId", 'General', r."id", r."kind", r."color", r."icon", NOW(), NOW()
FROM "Category" r
WHERE r."parentId" IS NULL
  AND r."kind" <> 'INTERNAL'
  AND (
    NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."parentId" = r."id")
    OR EXISTS (SELECT 1 FROM "Transaction" t WHERE t."categoryId" = r."id")
    OR EXISTS (SELECT 1 FROM "Subscription" s WHERE s."categoryId" = r."id")
  )
ON CONFLICT ("userId", "name", "parentId") DO NOTHING;

-- Lo asignado directo a una principal pasa a su "General"
UPDATE "Transaction" t SET "categoryId" = g."id"
FROM "Category" g
WHERE g."parentId" = t."categoryId" AND g."name" = 'General';

UPDATE "Subscription" s SET "categoryId" = g."id"
FROM "Category" g
WHERE g."parentId" = s."categoryId" AND g."name" = 'General';

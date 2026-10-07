-- Subcategorías predeterminadas con el icono de su principal (o sin icono):
-- reciben su icono propio. Pasa al importar un respaldo anterior a los iconos
-- de Tabler, que guardaba en cada subcategoría el icono de su principal. Los
-- iconos elegidos a mano (distintos al de la principal) no se tocan.

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
  ('Educación', 'Colegiaturas', 'school'),
  ('Educación', 'Cursos', 'certificate'),
  ('Educación', 'Libros y material', 'books'),
  ('Servicios', 'Teléfono', 'device-mobile'),
  ('Servicios', 'Seguros', 'shield-check'),
  ('Servicios', 'Bancos', 'building-bank'),
  ('Salario', 'Nómina', 'cash'),
  ('Salario', 'Bonos y aguinaldo', 'gift'),
  ('Ingresos extra', 'Freelance', 'device-laptop'),
  ('Ingresos extra', 'Ventas', 'tag'),
  ('Ingresos extra', 'Regalos', 'gift'),
  ('Ingresos extra', 'Inversiones', 'chart-line'),
  ('Otros', 'Varios', 'category')
) AS v("parent", "name", "icon"), "Category" p
WHERE c."parentId" = p."id"
  AND p."name" = v."parent"
  AND c."name" = v."name"
  AND (c."icon" IS NULL OR c."icon" = p."icon");

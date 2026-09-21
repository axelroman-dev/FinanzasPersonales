#!/bin/sh
set -e

echo "═══════════════════════════════════════════"
echo "  Iniciando Finanzas..."
echo "═══════════════════════════════════════════"

# Verificar variables de entorno requeridas
missing=""
for var in DATABASE_URL NEXTAUTH_SECRET; do
  if [ -z "$(eval echo \$$var)" ]; then
    missing="$missing $var"
  fi
done
if [ -n "$missing" ]; then
  echo "✗ ERROR: variables de entorno faltantes:$missing"
  echo "  Asegúrate de tener un .env con estos valores."
  exit 1
fi

# Generar cliente Prisma (necesario por si el schema cambió)
echo "→ Generando cliente Prisma..."
npx prisma generate

# Aplicar migraciones pendientes
echo "→ Aplicando migraciones..."
npx prisma migrate deploy

# Ejecutar seed si está definido (idempotente: el seed.ts no duplica datos)
if [ -f "prisma/seed.ts" ]; then
  echo "→ Ejecutando seed..."
  npx prisma db seed || echo "  (seed omitido o ya aplicado)"
fi

echo "→ Iniciando servidor Next.js..."
echo "═══════════════════════════════════════════"

# Iniciar Next.js (standalone server.js generado por output: 'standalone')
exec node server.js
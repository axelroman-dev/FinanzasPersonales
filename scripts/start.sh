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

# Adjuntos: si están activos, la carpeta tiene que ser escribible por este
# usuario (uid 1001). Un volumen creado por Docker queda a nombre de root.
if [ -n "$ATTACHMENTS_KEY" ]; then
  dir="${ATTACHMENTS_DIR:-/app/data/uploads}"
  if ! mkdir -p "$dir" 2>/dev/null || ! [ -w "$dir" ]; then
    echo "✗ ERROR: no se puede escribir en $dir (carpeta de adjuntos)."
    echo "  En el host: sudo chown -R 1001:1001 \${DATA_PATH}/finanzas/uploads"
    exit 1
  fi
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
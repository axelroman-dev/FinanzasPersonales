# Finanzas Personales

App web para gestionar finanzas personales, construida con **Next.js 14 + PostgreSQL + Prisma**.

Repo privado — imagen pensada para uso personal / self-hosted.

## Uso rápido

```bash
docker network create proxy   # si todavía no existe
docker login                  # con tu usuario/token de Docker Hub

curl -O https://raw.githubusercontent.com/axelroman-dev/FinanzasPersonales/main/.env.prod.example
cp .env.prod.example .env
nano .env                     # editar NEXTAUTH_SECRET, DB_PASSWORD, NEXTAUTH_URL

docker compose pull
docker compose up -d
docker compose logs app       # copiar el código de configuración inicial
```

Luego abre la app en el navegador: pedirá el código de los logs para crear la cuenta de administrador. No hay credenciales por defecto.

El `docker-compose.yml` de referencia está en el [repo del código fuente](https://github.com/axelroman-dev/FinanzasPersonales) y levanta la app + una base PostgreSQL 16.

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `NEXTAUTH_SECRET` | Generar con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL pública de la app |

Al arrancar, el contenedor corre automáticamente `prisma migrate deploy` y el seed inicial (idempotente).

Si pierdes la contraseña del admin: `docker compose exec app npx tsx scripts/reset-admin-password.ts [email]`.

## Tags

- `latest` — última versión publicada
- `X.Y.Z` — versión exacta (ej. `0.2.0`)
- `X.Y` — última versión de esa serie (ej. `0.2`)

## Código fuente

https://github.com/axelroman-dev/FinanzasPersonales

Imagen construida automáticamente vía GitHub Actions en cada release.

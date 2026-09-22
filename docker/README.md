# Finanzas Personales

App web para gestionar finanzas personales, construida con **Next.js 14 + PostgreSQL + Prisma**.

Repo privado — imagen pensada para uso personal / homelab.

## Uso rápido

```bash
docker network create proxy   # si todavía no existe
docker login                  # con tu usuario/token de Docker Hub

cp .env.prod.example .env     # ver plantilla en el repo del código fuente
nano .env                     # editar NEXTAUTH_SECRET, DB_PASSWORD, NEXTAUTH_URL

docker compose pull
docker compose up -d
```

El `docker-compose.yml` de referencia (incluido en el repo del código fuente) levanta la app + una base PostgreSQL 16.

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `NEXTAUTH_SECRET` | Generar con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL pública de la app |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Credenciales del admin inicial (solo se usan en el seed) |

Al arrancar, el contenedor corre automáticamente `prisma migrate deploy` y el seed inicial (idempotente).

## Tags

- `latest` — última build de la rama `main`
- `<sha>` — build fijada a un commit específico

## Código fuente

Imagen construida automáticamente vía GitHub Actions en cada push a `main`.

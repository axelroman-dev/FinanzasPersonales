# Finanzas Personales

App web para gestionar finanzas personales con **Next.js 14 + PostgreSQL**.

## Características principales

- 🔐 **Auth multi-usuario** con NextAuth (email + password, bcrypt)
- 👤 **Panel admin** para gestionar usuarios y configuración
- 💰 **Dashboard** con balance real (dinero disponible − deudas − compromisos del mes)
- 🏦 **Cuentas**: débito, crédito (con límite, % de uso, fechas de corte/pago), ahorro, vales de despensa
- 📊 **Subtotales por tipo de cuenta**
- 🔄 **Movimientos**: gastos, ingresos, transferencias con filtros (fechas, tipo, cuenta, MSI)
- 💳 **MSI** (Meses Sin Intereses): al registrar una compra MSI, se generan automáticamente las mensualidades
- 📺 **Suscripciones**: total mensual + proyección del balance después de pagar

## Stack

- Next.js 14 (App Router) + TypeScript
- PostgreSQL 16 vía Docker
- Prisma ORM
- NextAuth v5 (Auth.js)
- shadcn/ui + Tailwind CSS (modo oscuro minimalista)
- React Hook Form + Zod
- Recharts

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno de desarrollo
cp .env.local.example .env

# 3. Levantar PostgreSQL con Docker
npm run db:up

# 4. Generar cliente Prisma y correr migraciones
npm run prisma:generate
npm run prisma:migrate

# 5. Sembrar datos iniciales (admin)
npm run prisma:seed

# 6. Levantar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Credenciales del primer admin

Configuradas en `.env` (por defecto):

```
ADMIN_EMAIL="admin@finanzas.local"
ADMIN_PASSWORD="Admin123!"
```

⚠️ **Cambia la contraseña del admin después del primer login.**

## Comandos útiles

```bash
# ── Desarrollo local ──
npm run dev          # Servidor de desarrollo (Next.js + conecta a DB en Docker)
npm run db:up        # Levantar PostgreSQL (docker-compose.dev.yml)
npm run db:down      # Detener PostgreSQL
npm run db:reset     # Reset completo (BORRA DATOS)

# ── Producción (Docker) ──
npm run prod:up      # Build + levantar (docker-compose.yml)
npm run prod:down    # Detener stack
npm run prod:build   # Solo rebuild de la imagen
npm run prod:logs    # Tail de logs del contenedor app
npm run prod:reset   # Detener + borrar volúmenes + rebuild

# ── Prisma ──
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Crear/aplicar migraciones
npm run prisma:seed      # Ejecutar seed (idempotente)
npm run prisma:studio    # UI de Prisma para ver la DB

# ── Setup completo ──
npm run setup        # install + db + migrate + seed
```

## Variables de entorno

Hay dos plantillas: `.env.local.example` (desarrollo local) y `.env.prod.example` (Docker/producción). Las únicas variables requeridas son:

- `DATABASE_URL` — URL de conexión a PostgreSQL
- `NEXTAUTH_SECRET` — Genera con `openssl rand -base64 32`
- `NEXTAUTH_URL` — URL base (ej. `http://localhost:3000`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — Solo se usan en el seed inicial

## Estructura

```
src/
├── app/
│   ├── login/                # Login
│   ├── register/             # Registro (deshabilitable)
│   ├── (app)/                # Rutas protegidas (con sidebar)
│   │   ├── page.tsx          # Dashboard
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── subscriptions/
│   │   └── admin/            # Solo admins
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # Componentes shadcn
│   ├── dashboard/
│   ├── accounts/
│   ├── transactions/
│   ├── subscriptions/
│   ├── admin/
│   └── shared/               # Sidebar, providers
└── lib/
    ├── db.ts                 # Cliente Prisma
    ├── auth.ts               # Helpers de auth
    ├── admin.ts              # Config global
    ├── balance.ts            # Cálculo del balance real
    └── msi.ts                # Lógica de MSI
```

## Fórmula del balance real

```
Balance real =
  (suma débitos + ahorro)
  − (suma deuda usada en créditos)
  − (total suscripciones activas del mes)
  − (total mensualidades MSI pendientes del mes)
```

Los **vales de despensa** no cuentan en el balance.

## Seguridad

- Passwords hasheados con **bcrypt** (10 rounds)
- Sesiones JWT firmadas
- Middleware protege todas las rutas excepto `/login` y `/register`
- Todas las queries filtran por `userId` desde la sesión (nunca del cliente)
- Verificación de `isActive` en cada request
- Validación con **Zod** en todos los endpoints

## Despliegue

### Opción A — Docker (recomendado para self-hosting)

El proyecto incluye dos archivos compose:

| Archivo | Propósito |
|---|---|
| `docker-compose.yml` | **Producción**: app Next.js + PostgreSQL |
| `docker-compose.dev.yml` | **Desarrollo**: solo PostgreSQL (la app corre con `npm run dev`) |

#### Producción

```bash
# 1. Preparar variables
cp .env.prod.example .env
nano .env  # cambiar NEXTAUTH_SECRET y DB_PASSWORD

# 2. Build + levantar (primera vez tarda 3-5 min)
npm run prod:up
# equivalente a: docker compose up -d --build

# 3. Ver logs
npm run prod:logs
# equivalente a: docker compose logs -f app
```

**Build manual y push a tu servidor**:
```bash
# Build local
docker build -t finanzas:1.0 .

# Guardar imagen
docker save finanzas:1.0 | gzip > finanzas.tar.gz

# Transferir (ejemplo con SCP)
scp finanzas.tar.gz usuario@tu-servidor:~/

# En el servidor
ssh usuario@tu-servidor
docker load < finanzas.tar.gz
cd /path/al/proyecto
cp .env.prod.example .env && nano .env
npm run prod:up
```

**Solo imagen de la app** (sin PostgreSQL incluido, usando una DB externa):
```bash
docker build -t finanzas:1.0 .
docker run -d --name finanzas \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/finanzas" \
  -e NEXTAUTH_SECRET="tu-secreto" \
  -e NEXTAUTH_URL="http://tu-servidor:3000" \
  --restart unless-stopped \
  finanzas:1.0
```

**Imagen publicada en registry**:
```bash
docker push tu-usuario/finanzas:1.0
# En el servidor
docker compose pull && up -d
```

#### Desarrollo

```bash
# Solo levantar la DB
npm run db:up
# equivalente a: docker compose -f docker-compose.dev.yml up -d

# Arrancar Next.js (en otra terminal)
npm run dev

# Detener DB
npm run db:down
```

### Características del Dockerfile

- Multi-stage build (deps → builder → runner)
- Imagen final basada en `node:20-alpine` (~700 MB con engines de Prisma)
- Usuario no-root (`nextjs`, UID 1001)
- `dumb-init` para propagación correcta de señales (graceful shutdown)
- `prisma generate`, `migrate deploy` y `db seed` corren automáticamente al arrancar
- Healthchecks incluidos en el compose
- Volumen `finanzas_pgdata` para persistencia

### Actualizar el despliegue

```bash
# Rebuild imagen con cambios
npm run prod:build
# equivalente a: docker compose build --no-cache app

# Reiniciar
npm run prod:up

# Ver logs
npm run prod:logs
```

### Opción B — Despliegue manual (sin Docker)

1. Configura un PostgreSQL gestionado (Supabase, Neon, Railway, etc.)
2. Setea las variables de entorno en tu plataforma
3. Corre las migraciones: `npx prisma migrate deploy`
4. Ejecuta el seed una vez: `npx prisma db seed`
5. Build: `npm run build`
6. Inicia: `npm run start`

## Licencia

MIT

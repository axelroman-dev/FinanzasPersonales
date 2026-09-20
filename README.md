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

# 2. Levantar PostgreSQL con Docker
npm run db:up

# 3. Generar cliente Prisma y correr migraciones
npm run prisma:generate
npm run prisma:migrate

# 4. Sembrar datos iniciales (admin)
npm run prisma:seed

# 5. Levantar el servidor de desarrollo
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
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Iniciar producción

npm run db:up        # Levantar PostgreSQL
npm run db:down      # Detener PostgreSQL
npm run db:reset     # Reset completo (BORRA DATOS)

npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Crear/aplicar migraciones
npm run prisma:seed      # Ejecutar seed
npm run prisma:studio    # UI de Prisma para ver la DB

npm run setup        # Todo el setup inicial (install + db + migrate + seed)
```

## Variables de entorno

Ver `.env.example`. Las únicas requeridas son:

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

Para producción:

1. Configura un PostgreSQL gestionado (Supabase, Neon, Railway, etc.)
2. Setea las variables de entorno en tu plataforma
3. Corre las migraciones: `npx prisma migrate deploy`
4. Ejecuta el seed una vez: `npx prisma db seed`
5. Build: `npm run build`
6. Inicia: `npm run start`

## Licencia

MIT

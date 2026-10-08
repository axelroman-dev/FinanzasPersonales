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
- 🗂️ **Categorías** y subcategorías personalizables
- 📈 **Reportes** con filtros por periodo
- 📦 **Exportar / importar** datos (admin)

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

# 5. Sembrar datos iniciales
npm run prisma:seed

# 6. Levantar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Primer inicio: el admin

La app crea al arrancar un administrador fijo:

- **Email:** `admin@finanzas.local`
- **Contraseña:** la de `ADMIN_PASSWORD` en el `.env` (obligatoria, mínimo 12 caracteres). Sin ella el servidor no arranca.

Su email y nombre no se pueden modificar, ni se puede desactivar, degradar o eliminar. El `.env` es la fuente de verdad de su contraseña: en cada arranque se sincroniza, así que para cambiarla (o recuperarla) se edita `ADMIN_PASSWORD` y se reinicia el servidor.

El registro público está desactivado por defecto; se puede activar en *Configuración*.

## Adjuntos (recibos)

Cada movimiento puede tener hasta 10 fotos o PDF de hasta 10 MB. Desde el celular, **Tomar foto** abre la cámara. Para activarlos:

1. Genera una clave con `openssl rand -base64 32` y ponla en `ATTACHMENTS_KEY` en el `.env`.
2. En Docker, crea la carpeta del volumen con el dueño correcto:
   ```bash
   sudo mkdir -p ${DATA_PATH}/finanzas/uploads
   sudo chown -R 1001:1001 ${DATA_PATH}/finanzas/uploads
   ```
3. Si usas un reverse proxy, permite subidas de 10 MB o más (en nginx: `client_max_body_size 12m;`).

Sobre los archivos:
- **Cifrado:** se guardan cifrados. Quien copie la carpeta o un respaldo sin la clave no puede abrirlos.
- **Respaldo:** un respaldo completo es **la base de datos + la carpeta `uploads` + `ATTACHMENTS_KEY`**. Si se pierde la clave, los adjuntos no se pueden recuperar.
- **Formatos:** las fotos HEIC no se aceptan. En iPhone, Safari normalmente las convierte a JPEG al subirlas; si no, usa Ajustes › Cámara › Formatos › Más compatible.
- **Exportar / importar:** el export es un `.zip` con `datos.json` y la carpeta `adjuntos/`, con los recibos **descifrados** (para poder restaurarlos en otro servidor con otra clave): guárdalo en un lugar seguro. Al importar, los adjuntos se validan igual que una subida normal. Los `.json` de versiones anteriores se siguen pudiendo importar.
- **Huérfanos:** para limpiar archivos que quedaron sin registro (por ejemplo, tras una caída del servidor):
  ```bash
  docker compose exec app npx tsx scripts/cleanup-attachments.ts          # lista
  docker compose exec app npx tsx scripts/cleanup-attachments.ts --apply  # borra
  ```

## Correo

Con correo configurado, la app permite **recuperar la contraseña** («¿Olvidaste tu contraseña?» en el login) y manda **avisos de seguridad** cuando una contraseña cambia. Sin correo, todo lo demás funciona igual.

1. Agrega al `.env` los datos SMTP de tu proveedor. Con Hostinger:
   ```bash
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465            # SSL; 587 = STARTTLS
   SMTP_USER=finanzas@tudominio.com
   SMTP_PASSWORD=...
   MAIL_FROM="Finanzas Personales <finanzas@tudominio.com>"
   ```
2. Reinicia la app. En los logs aparece «Correo listo» o el error de conexión.
3. Prueba en **Admin › Configuración › Enviar correo de prueba**.

Para que no lleguen a spam, el dominio necesita registros **SPF, DKIM y DMARC**. Los enlaces de los correos usan `NEXTAUTH_URL`, así que debe ser la URL pública.

En desarrollo, `npm run db:up` también levanta **Mailpit**, un buzón de prueba: con `SMTP_HOST=localhost` y `SMTP_PORT=1025`, los correos se ven en http://localhost:8025 sin enviarse de verdad.

## Comandos útiles

```bash
# ── Desarrollo local ──
npm run dev          # Servidor de desarrollo (Next.js + conecta a DB en Docker)
npm run db:up        # Levantar PostgreSQL (docker-compose.dev.yml)
npm run db:down      # Detener PostgreSQL
npm run db:reset     # Reset completo (BORRA DATOS)
npm test             # Tests unitarios (Vitest)

# ── Producción (Docker) ──
npm run prod:up      # Descargar la imagen + levantar (docker-compose.yml)
npm run prod:down    # Detener stack
npm run prod:pull    # Solo descargar la imagen
npm run prod:logs    # Tail de logs del contenedor app
npm run prod:reset   # Detener + descargar la imagen + levantar

# ── Prisma ──
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate   # Crear/aplicar migraciones
npm run prisma:seed      # Ejecutar seed (idempotente)
npm run prisma:studio    # UI de Prisma para ver la DB

# ── Setup completo ──
npm run setup        # install + db + migrate + seed
```

## Variables de entorno

Hay dos plantillas: `.env.local.example` (desarrollo local) y `.env.prod.example` (Docker/producción).

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | Desarrollo | URL de conexión a PostgreSQL. En producción la arma `docker-compose.yml` a partir de `DB_PASSWORD` |
| `DB_PASSWORD` | Producción | Password de PostgreSQL |
| `NEXTAUTH_SECRET` | Ambos | Genera con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Ambos | URL base (ej. `http://localhost:3000`) |
| `ADMIN_PASSWORD` | Ambos | Contraseña de `admin@finanzas.local` (obligatoria, mínimo 12 caracteres) |
| `ATTACHMENTS_KEY` | Ambos | Clave para cifrar los adjuntos (opcional; sin ella están desactivados). Genera con `openssl rand -base64 32` |
| `ATTACHMENTS_DIR` | Ambos | Carpeta de adjuntos (opcional; por defecto `./data/uploads`, en Docker `/app/data/uploads`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Ambos | Correo (opcional; sin `SMTP_HOST` está desactivado). Ver [Correo](#correo) |
| `TZ` | Producción | Zona horaria del servidor (por defecto `America/Mexico_City`) |
| `DATA_PATH` | Producción | Carpeta del host donde se guardan los datos de PostgreSQL y los adjuntos (por defecto `/data`) |
| `IMAGE_TAG` | Producción | Versión de la imagen a usar (por defecto `latest`) |

## Estructura

```
src/
├── app/
│   ├── login/                # Login
│   ├── register/             # Registro (deshabilitable)
│   ├── change-password/      # Cambio de contraseña obligatorio
│   ├── (app)/                # Rutas protegidas (con sidebar)
│   │   ├── page.tsx          # Dashboard
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── subscriptions/
│   │   ├── categories/
│   │   ├── reports/
│   │   ├── profile/
│   │   └── admin/            # Solo admins
│   └── api/                  # API routes
├── components/
│   ├── ui/                   # Componentes shadcn
│   ├── dashboard/
│   ├── accounts/
│   ├── transactions/
│   ├── subscriptions/
│   ├── categories/
│   ├── reports/
│   ├── profile/
│   ├── settings/             # Import / export
│   ├── admin/
│   └── shared/               # Sidebar, providers
├── lib/
│   ├── db.ts                 # Cliente Prisma
│   ├── auth.ts               # Helpers de auth
│   ├── admin.ts              # Config global
│   ├── balance.ts            # Cálculo del balance real
│   ├── msi.ts                # Lógica de MSI
│   ├── categories.ts         # Categorías por defecto
│   ├── export-import.ts      # Exportar / importar datos
│   └── utils.ts
├── auth.ts                   # Configuración de NextAuth
└── middleware.ts             # Protección de rutas
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

- Sin credenciales por defecto: la contraseña del admin del sistema es obligatoria y viene del `.env`
- El registro público está desactivado por defecto
- Passwords hasheados con **bcrypt** (10 rounds)
- Sesiones JWT firmadas
- Middleware protege todas las rutas excepto `/login`, `/register`, `/forgot-password` y `/reset-password`
- Usuarios con `mustChangePassword` son redirigidos a `/change-password` hasta que la cambien
- Cambiar o restablecer la contraseña cierra las sesiones abiertas en otros dispositivos
- Recuperar contraseña: enlace de un solo uso que vence en 1 hora; en la base solo se guarda su SHA-256; la respuesta no revela si un correo tiene cuenta; límite de solicitudes por correo y por IP
- Todas las queries filtran por `userId` desde la sesión (nunca del cliente)
- `isActive` y el rol se verifican contra la DB en cada request: desactivar, eliminar o cambiar el rol de un usuario aplica de inmediato aunque tenga una sesión abierta
- Validación con **Zod** en todos los endpoints
- Adjuntos (recibos):
  - cifrados en disco con **AES-256-GCM** (`ATTACHMENTS_KEY`);
  - el tipo se detecta por el contenido, no por la extensión;
  - las fotos se recodifican sin metadatos (EXIF, GPS);
  - solo se sirven al dueño, por la API y con headers que impiden ejecutar contenido

## Flujo de trabajo

`main` está protegida: no se puede hacer push directo. Todo cambio entra por pull request.

```bash
# 1. Partir de main actualizado
git checkout main && git pull

# 2. Crear una rama (prefijo según el tipo de cambio: feat/, fix/, docs/, chore/, ci/)
git checkout -b feat/nombre-del-cambio

# 3. Commits y push de la rama
git push -u origin feat/nombre-del-cambio

# 4. Abrir el PR
gh pr create --fill

# 5. (Opcional) Esperar el CI
gh pr checks --watch

# 6. Mergear y borrar la rama
gh pr merge --squash --delete-branch
```

### Reglas de `main`

| Regla | Detalle |
|---|---|
| Pull request obligatorio | Sin approvals requeridos |
| Método de merge | Solo **Squash**: un commit por PR |
| Check requerido | `check` (workflow de CI) debe pasar |
| Protecciones | No se permite borrar `main` ni hacer force push |

### GitHub Actions

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | En cada PR hacia `main` | `npm ci` → `prisma generate` → `tsc --noEmit` → `npm test` → `next build` |
| `release.yml` | Al mergear a `main` | Mantiene el PR de release; al mergear ese PR crea el tag, el GitHub Release y publica la imagen en Docker Hub |

## Versionado

El proyecto usa [SemVer](https://semver.org/lang/es/) y [release-please](https://github.com/googleapis/release-please). La versión se calcula a partir de los títulos de los PRs (que con squash son el mensaje del commit en `main`), así que deben seguir [Conventional Commits](https://www.conventionalcommits.org/es/):

| Prefijo | Efecto en `0.x` | Aparece en el CHANGELOG |
|---|---|---|
| `fix:` | 0.1.0 → 0.1.1 | Sí (Correcciones) |
| `feat:` | 0.1.0 → 0.2.0 | Sí (Nuevas funciones) |
| `feat!:` / `BREAKING CHANGE:` | 0.1.0 → 0.2.0 | Sí |
| `docs:`, `chore:`, `ci:`, `refactor:` | Ninguno | No |

**Cómo sale una versión:**

1. Al mergear PRs con `feat:` o `fix:`, release-please abre (o actualiza) un PR `chore(main): release X.Y.Z` con la nueva versión en `package.json` y las notas en `CHANGELOG.md`.
2. Cuando quieras publicar, mergea ese PR.
3. Se crea el tag `vX.Y.Z`, el GitHub Release y se publica la imagen con los tags `X.Y.Z`, `X.Y` y `latest`.

**Pasar a 1.0.0:** mergea un PR cuyo commit incluya en el cuerpo la línea `Release-As: 1.0.0`.

Requiere el secret `RELEASE_PLEASE_TOKEN`: un fine-grained PAT con permisos de lectura/escritura en *Contents*, *Pull requests* e *Issues* sobre este repo. Se usa en lugar de `GITHUB_TOKEN` para que el PR de release dispare el CI.

## Despliegue

### Opción A — Docker (recomendado para self-hosting)

El proyecto incluye dos archivos compose:

| Archivo | Propósito |
|---|---|
| `docker-compose.yml` | **Producción**: app Next.js + PostgreSQL |
| `docker-compose.dev.yml` | **Desarrollo**: solo PostgreSQL (la app corre con `npm run dev`) |

#### Producción

`docker-compose.yml` usa la imagen publicada en Docker Hub (`axelromandev/finanzas-personales`, repo privado) y no publica puertos en el host: la app se expone a través de un reverse proxy (nginx, Caddy, Cloudflare Tunnel, etc.) conectado a la red externa `proxy`, que llega al contenedor como `finanzas-app:3000`.

```bash
# 1. Preparar el servidor
docker network create proxy   # si todavía no existe
docker login                  # la imagen está en un repo privado

# 2. Preparar variables
cp .env.prod.example .env
nano .env  # cambiar NEXTAUTH_SECRET, DB_PASSWORD y NEXTAUTH_URL

# 3. Descargar la imagen + levantar
npm run prod:up
# equivalente a: docker compose pull && docker compose up -d

# 4. Ver logs
npm run prod:logs
# equivalente a: docker compose logs -f app
```

**Sin acceso a la imagen privada** (por ejemplo, si clonaste el repo): construye tu propia imagen y ajusta `image:` en `docker-compose.yml`.
```bash
docker build -t finanzas-personales .
```

**Solo imagen de la app** (sin PostgreSQL incluido, usando una DB externa):
```bash
docker run -d --name finanzas \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/finanzas" \
  -e NEXTAUTH_SECRET="tu-secreto" \
  -e NEXTAUTH_URL="http://tu-servidor:3000" \
  --restart unless-stopped \
  finanzas-personales
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
- Datos de PostgreSQL en `${DATA_PATH}/finanzas/postgres` del host (bind mount)

### Actualizar el despliegue

Cada release publica una imagen nueva (ver [Versionado](#versionado)).

```bash
# Última versión (latest)
npm run prod:up

# O fijar una versión específica
IMAGE_TAG=0.2.0 npm run prod:up   # o definir IMAGE_TAG en el .env

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

[MIT](LICENSE)

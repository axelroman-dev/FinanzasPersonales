# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────
# Stage 1: deps — instalar dependencias con cache de capas
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copiar package files y prisma schema (necesario para postinstall de Prisma)
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Si tenés package-lock.json usá npm ci (más rápido y reproducible).
# Si no, caés a npm install automáticamente.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ─────────────────────────────────────────────────────────────
# Stage 2: builder — compilar Next.js
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desactivar telemetría en builds
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generar cliente Prisma
RUN npx prisma generate

# Build de Next.js
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3: runner — imagen final ligera (~180 MB)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar solo lo necesario desde el builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Instalar dependencias mínimas para el start.sh: Prisma CLI + client + tsx
# Solo --omit=dev, sin lockfile del proyecto (no los necesitamos)
RUN npm install --no-save --omit=dev --no-audit --no-fund --prefer-offline \
      @prisma/client@5.22.0 \
      prisma@5.22.0 \
      tsx@4.19.2 \
    && npm cache clean --force

# Asegurar permisos en scripts
RUN chmod +x ./scripts/start.sh

USER nextjs

EXPOSE 3000

# dumb-init propaga señales correctamente (importante para docker stop)
ENTRYPOINT ["dumb-init", "--", "./scripts/start.sh"]
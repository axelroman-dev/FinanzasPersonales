const { version } = require("./package.json");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Versión de la app (la sube release-please en package.json), visible en el
  // menú lateral. Se fija al compilar.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // La app no usa next/image: desactivar el optimizador cierra el endpoint
  // /_next/image, afectado por CVEs que solo se corrigen en Next 15.5+
  images: {
    unoptimized: true,
  },
  experimental: {
    // Habilita src/instrumentation.ts (crea/sincroniza el admin del sistema)
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;

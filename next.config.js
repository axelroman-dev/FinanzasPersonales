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
  // /_next/image, que ha tenido varios CVEs
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;

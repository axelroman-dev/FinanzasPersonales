/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // La app no usa next/image: desactivar el optimizador cierra el endpoint
  // /_next/image, afectado por CVEs que solo se corrigen en Next 15.5+
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

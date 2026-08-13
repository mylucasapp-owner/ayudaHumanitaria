import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // La app se sirve como estático desde Firebase Hosting: sin servidor,
  // arranque instantáneo y cacheable en el borde (crítico con 3G/Edge).
  output: "export",
  images: { unoptimized: true },
  // `output: export` genera /ruta/index.html; trailingSlash evita 404 al recargar.
  trailingSlash: true,
};

export default nextConfig;

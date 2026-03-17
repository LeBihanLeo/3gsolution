import type { NextConfig } from "next";

// Note : next-pwa n'est pas compatible avec Turbopack (Next.js 16).
// La PWA est implémentée manuellement via public/sw.js + SwRegister client component.
const nextConfig: NextConfig = {
  turbopack: {},
};

export default nextConfig;

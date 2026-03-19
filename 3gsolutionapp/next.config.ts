import type { NextConfig } from "next";

// Note : next-pwa n'est pas compatible avec Turbopack (Next.js 16).
// La PWA est implémentée manuellement via public/sw.js + SwRegister client component.
const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        // TICK-038 — Autoriser les images Vercel Blob pour next/image
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;

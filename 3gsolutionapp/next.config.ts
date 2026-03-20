// TICK-051 — SEC-02 : Headers de sécurité HTTP (OWASP A05:2021)
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
  async headers() {
    // TICK-061 — NEW-02 : unsafe-eval retiré de la CSP de production
    // Turbopack (HMR) nécessite unsafe-eval uniquement en développement.
    // Le build statique Next.js n'utilise pas eval() — l'inclure en prod affaiblit la CSP inutilement.
    const isDev = process.env.NODE_ENV === 'development';

    const csp = [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" // Turbopack HMR en dev
        : "script-src 'self' 'unsafe-inline'",              // Production : eval() interdit
      "style-src 'self' 'unsafe-inline'",                   // Tailwind inline styles
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "font-src 'self'",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",                            // Service worker PWA
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // Empêche le clickjacking (intégration dans une iframe)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche le MIME-sniffing par le navigateur
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Contrôle les informations envoyées dans le Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactive les fonctionnalités sensibles non utilisées
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;

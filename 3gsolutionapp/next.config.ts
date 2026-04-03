// TICK-051 — SEC-02 : Headers de sécurité HTTP (OWASP A05:2021)
// CVE-06  — CSP retirée d'ici et gérée dynamiquement dans middleware.ts (nonce par requête)
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
    const isDev = process.env.NODE_ENV === 'development';

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
          // CVE-05 — HSTS : force HTTPS et protège contre le SSL stripping
          // max-age=1 an | includeSubDomains | preload (soumission à la liste HSTS navigateurs)
          // Uniquement en production — en dev, HTTPS n'est pas toujours disponible
          ...(!isDev
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
            : []),
          // Note : Content-Security-Policy est géré dynamiquement dans middleware.ts
          // avec un nonce par requête pour supprimer unsafe-inline (CVE-06).
        ],
      },
    ];
  },
};

export default nextConfig;

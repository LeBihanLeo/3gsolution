// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
// TICK-071 — Routes client protégées + vérification de rôle
// TICK-078 — Rate limiting endpoints auth client
// CVE-06  — CSP dynamique avec nonce par requête (suppression de unsafe-inline)
// TICK-132 — Tenant resolver : injection x-tenant-id depuis Host header (multi-tenant)
// TICK-138 — Protection routes /superadmin/* et /api/superadmin/* (JWT superadmin séparé)
import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { verifySuperadminToken } from '@/lib/superadmin-jwt';
import {
  checkLoginRateLimit,
  checkRegisterRateLimit,
  checkForgotPasswordRateLimit,
  checkCheckoutRateLimit,
} from '@/lib/ratelimit';
import { resolveTenantId } from '@/lib/tenant-resolver';

// ── Extraction IP (Vercel Edge, non spoofable) ─────────────────────────────
function extractIp(request: NextRequest): string {
  return (
    (request as NextRequest & { ip?: string }).ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

// ── Réponse 429 avec Retry-After ──────────────────────────────────────────
function rateLimitResponse(reset: number): NextResponse {
  const retryAfter = Math.max(0, reset - Math.floor(Date.now() / 1000));
  return new NextResponse('Trop de tentatives. Réessayez plus tard.', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': String(retryAfter),
    },
  });
}

// ── CVE-06 : Génération CSP dynamique avec nonce par requête ───────────────
function generateCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    isDev
      ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`
      : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",  // Tailwind inline styles
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://challenges.cloudflare.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:", // Service worker PWA
  ].join('; ');
}

export default withAuth(
  async function middleware(request: NextRequest & { nextauth?: { token?: { role?: string; restaurantId?: string } } }) {
    const { pathname } = request.nextUrl;
    const ip = extractIp(request);

    // ── TICK-132 : Résolution tenant ────────────────────────────────────────
    // Priorité absolue : injecter x-tenant-id avant toute autre vérification.
    const host = request.headers.get('host') ?? '';
    const internalBase = new URL(request.url).origin;
    let tenantId = await resolveTenantId(host, internalBase);

    // Fallback JWT : si le fetch _tenant échoue (ex. Turbopack dev, réseau, timeout)
    // et que l'admin est authentifié, son JWT signé contient restaurantId → source de vérité sûre.
    if (!tenantId) {
      const jwtToken = request.nextauth?.token;
      if (jwtToken?.restaurantId && typeof jwtToken.restaurantId === 'string') {
        tenantId = jwtToken.restaurantId;
      }
    }

    if (!tenantId) {
      // Domaine inconnu en production → 404
      const isDevOrPreview =
        host.startsWith('localhost') ||
        host.startsWith('127.0.0.1') ||
        host.endsWith('.vercel.app') ||
        host.split(':')[0].endsWith('.localhost');

      if (!isDevOrPreview && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Restaurant introuvable' },
          { status: 404 }
        );
      }
    }

    // ── TICK-138 : Protection superadmin ───────────────────────────────────
    const isSuperadminPage = pathname.startsWith('/superadmin') && pathname !== '/superadmin/login';
    const isSuperadminApi =
      pathname.startsWith('/api/superadmin/') && pathname !== '/api/superadmin/auth';

    if (isSuperadminPage || isSuperadminApi) {
      const token = request.cookies.get('superadmin_token')?.value ?? null;
      const payload = token ? await verifySuperadminToken(token) : null;

      if (!payload) {
        if (isSuperadminApi) {
          return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/superadmin/login', request.url));
      }
    }

    // ── Rate limiting login admin ──────────────────────────────────────────
    if (pathname === '/api/auth/callback/credentials') {
      const { success, reset } = await checkLoginRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Rate limiting register (TICK-078) ─────────────────────────────────
    if (pathname === '/api/client/register' && request.method === 'POST') {
      const { success, reset } = await checkRegisterRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Rate limiting forgot-password (TICK-078) ──────────────────────────
    if (pathname === '/api/client/forgot-password' && request.method === 'POST') {
      const { success, reset } = await checkForgotPasswordRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Rate limiting checkout — protège le quota Stripe API ──────────────
    if (pathname === '/api/checkout' && request.method === 'POST') {
      const { success, reset } = await checkCheckoutRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Vérification de rôle : admin requis ───────────────────────────────
    const token = request.nextauth?.token;
    const isAdminRoute =
      (pathname.startsWith('/admin/') && pathname !== '/admin/login') ||
      (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
      pathname.startsWith('/api/admin/') ||
      pathname === '/api/upload';

    if (isAdminRoute && token && token.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Accès refusé.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    // ── TICK-136 : Protection cross-tenant admin ───────────────────────────
    // Un admin de restoA avec son token ne peut pas accéder aux routes admin de restoB.
    if (isAdminRoute && token?.role === 'admin' && tenantId && token.restaurantId) {
      if (token.restaurantId !== tenantId) {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(JSON.stringify({ error: 'Accès refusé : tenant invalide.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }

    // ── Vérification de rôle : client requis ─────────────────────────────
    const isClientRoute =
      pathname === '/profil' ||
      pathname.startsWith('/api/client/profil') ||
      pathname.startsWith('/api/client/account') ||
      pathname.startsWith('/api/client/commandes') ||
      pathname.startsWith('/api/client/export');

    if (isClientRoute && token && token.role !== 'client') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Authentification requise.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // ── CVE-06 : Nonce CSP par requête ────────────────────────────────────
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = generateCsp(nonce);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    if (tenantId) {
      requestHeaders.set('x-tenant-id', tenantId);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Routes statiques et assets Next.js : toujours autorisées
        if (
          pathname.startsWith('/_next/') ||
          pathname.startsWith('/favicon') ||
          pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/)
        ) return true;

        // Route interne tenant-resolver : toujours autorisée (appelée par le middleware)
        if (pathname === '/api/tenant-resolver') return true;

        // Routes superadmin : gèrent leur propre auth (cookie JWT superadmin)
        if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin/')) return true;

        // Routes publiques : toujours autorisées
        if (pathname.startsWith('/api/auth/')) return true;
        if (pathname === '/api/client/register') return true;
        if (pathname === '/api/client/forgot-password') return true;
        if (pathname === '/api/commandes/suivi') return true;
        if (pathname === '/api/commandes/raison-echec') return true;

        // Routes client protégées : token requis
        const clientProtected =
          pathname === '/profil' ||
          pathname.startsWith('/api/client/profil') ||
          pathname.startsWith('/api/client/account') ||
          pathname.startsWith('/api/client/commandes') ||
          pathname.startsWith('/api/client/export');

        if (clientProtected) return !!token;

        // Routes admin : token requis
        if (pathname === '/admin/login') return true;

        const adminRoute =
          pathname.startsWith('/admin/') ||
          (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
          pathname.startsWith('/api/admin/') ||
          pathname === '/api/upload' ||
          pathname === '/api/auth/callback/credentials';

        if (adminRoute) return !!token;

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/tenant-resolver|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)',
  ],
};

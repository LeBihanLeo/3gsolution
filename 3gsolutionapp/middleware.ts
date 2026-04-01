// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
// TICK-071 — Routes client protégées + vérification de rôle
// TICK-078 — Rate limiting endpoints auth client
import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  checkRegisterRateLimit,
  checkForgotPasswordRateLimit,
} from '@/lib/ratelimit';

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

export default withAuth(
  async function middleware(request: NextRequest & { nextauth?: { token?: { role?: string } } }) {
    const { pathname } = request.nextUrl;
    const ip = extractIp(request);

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

    // ── Vérification de rôle : admin requis ───────────────────────────────
    // Un client connecté ne peut pas accéder aux routes admin
    const token = request.nextauth?.token;
    const isAdminRoute =
      pathname.startsWith('/admin/') ||
      // /api/commandes/suivi est public — on exclut explicitement ce chemin
      (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
      pathname === '/api/upload';
      // /api/site-config retiré : GET est public, PUT protégé par getServerSession dans le handler

    if (isAdminRoute && token && token.role !== 'admin') {
      // Connecté mais pas admin → 403
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Accès refusé.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return NextResponse.redirect(new URL('/', request.url));
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

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Routes publiques : toujours autorisées (rate limiting géré ci-dessus)
        if (pathname.startsWith('/api/auth/')) return true;
        if (pathname === '/api/client/register') return true;
        if (pathname === '/api/client/forgot-password') return true;
        // Suivi de commande public (page /confirmation — pas d'auth requise)
        if (pathname === '/api/commandes/suivi') return true;

        // Routes client protégées : token requis
        const clientProtected =
          pathname === '/profil' ||
          pathname.startsWith('/api/client/profil') ||
          pathname.startsWith('/api/client/account') ||
          pathname.startsWith('/api/client/commandes') ||
          pathname.startsWith('/api/client/export');

        if (clientProtected) return !!token;

        // Toutes les autres routes dans le matcher : token requis (admin)
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Interface admin
    '/admin/commandes/:path*',
    '/admin/menu/:path*',
    '/admin/personnalisation/:path*',
    // API commandes (admin) — /api/commandes/suivi est public (exclu dans authorized + isAdminRoute)
    '/api/commandes',
    '/api/commandes/:id/statut',
    '/api/commandes/:id',
    // API admin (défense en profondeur)
    '/api/upload',
    // '/api/site-config' retiré : GET public, PUT protégé dans le handler par getServerSession
    // Rate limiting login admin
    '/api/auth/callback/credentials',
    // Routes client protégées (TICK-071)
    '/profil',
    '/api/client/profil',
    '/api/client/account',
    '/api/client/commandes',
    '/api/client/export',
    // Rate limiting auth client (TICK-078)
    '/api/client/register',
    '/api/client/forgot-password',
  ],
};

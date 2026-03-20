// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { checkLoginRateLimit } from '@/lib/ratelimit';

export default withAuth(
  async function middleware(request: NextRequest) {
    // ── Rate limiting sur l'endpoint de login NextAuth ────────────────────────
    // TICK-052 : 10 tentatives max par IP sur 15 minutes glissantes
    if (request.nextUrl.pathname === '/api/auth/callback/credentials') {
      // TICK-062 — NEW-04 : utiliser request.ip en priorité (Vercel Edge, non spoofable)
      // x-forwarded-for peut être manipulé par le client pour contourner le rate limiting
      const ip =
        (request as NextRequest & { ip?: string }).ip ??
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.headers.get('x-real-ip') ??
        '127.0.0.1';

      const { success, reset } = await checkLoginRateLimit(ip);

      if (!success) {
        const retryAfter = Math.max(0, reset - Math.floor(Date.now() / 1000));
        console.warn(`[security] Login rate limit dépassé — IP: ${ip}`);
        return new NextResponse('Trop de tentatives de connexion. Réessayez plus tard.', {
          status: 429,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Retry-After': String(retryAfter),
          },
        });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Pour les routes dans le matcher (hors rate-limiting) : token requis
      // La route /api/auth/callback/credentials est dans le matcher uniquement
      // pour le rate limiting — NextAuth gère lui-même son authentification.
      authorized: ({ token, req }) => {
        // L'endpoint de login NextAuth doit être accessible sans token
        if (req.nextUrl.pathname.startsWith('/api/auth/')) return true;
        return !!token;
      },
    },
  }
);

// Routes protégées par le middleware :
// • Routes admin UI (redirect /admin/login si non authentifié)
// • API commandes (401 si non authentifié)
// • API admin : produits (POST/PUT/PATCH/DELETE), upload, site-config (PUT)
//   → TICK-054 : défense en profondeur, les handlers vérifient aussi getServerSession
// • /api/auth/callback/credentials → rate limiting uniquement (pas de guard token)
//
// Routes publiques intentionnelles (non incluses) :
// • GET /api/produits
// • GET /api/site-config
// • GET /api/commandes/suivi
// • POST /api/checkout
// • POST /api/webhooks/stripe
export const config = {
  matcher: [
    // Interface admin
    '/admin/commandes/:path*',
    '/admin/menu/:path*',
    '/admin/personnalisation/:path*',
    // API commandes (admin)
    '/api/commandes',
    '/api/commandes/:id/statut',
    '/api/commandes/:id',        // TICK-062 — DELETE anonymisation RGPD (défense en profondeur)
    // API admin — TICK-054 : défense en profondeur
    // /api/produits (GET) est public — retiré du matcher (handler vérifie getServerSession pour POST/PUT/DELETE)
    '/api/upload',
    '/api/site-config',
    // Rate limiting login — TICK-052
    '/api/auth/callback/credentials',
  ],
};

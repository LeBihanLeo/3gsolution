// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { checkLoginRateLimit } from '@/lib/ratelimit';

export default withAuth(
  async function middleware(request: NextRequest) {
    // ── Rate limiting sur les endpoints de login NextAuth ─────────────────────
    // TICK-052 : 10 tentatives max par IP sur 15 minutes glissantes
    // Couvre admin-credentials et client-credentials
    const path = request.nextUrl.pathname;
    const isCredentialCallback =
      path === '/api/auth/callback/credentials' ||           // backward compat
      path === '/api/auth/callback/admin-credentials' ||
      path === '/api/auth/callback/client-credentials';

    if (isCredentialCallback) {
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
      // Séparation stricte des rôles :
      // • Routes admin  → token.role === 'admin' uniquement
      // • Routes client → token.role === 'client' ou 'admin'
      // • Endpoints NextAuth → toujours accessibles (gestion interne)
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Endpoints NextAuth internes — toujours accessibles
        if (path.startsWith('/api/auth/')) return true;

        // Routes espace client
        if (path.startsWith('/mon-compte')) {
          return token?.role === 'client' || token?.role === 'admin';
        }

        // Routes admin — rôle strict
        return token?.role === 'admin';
      },
    },
  }
);

// Routes protégées par le middleware :
// • Routes admin UI (redirect /admin/login si non authentifié)
// • API commandes (401 si non authentifié)
// • API admin : upload, site-config — TICK-054 : défense en profondeur
// • /api/auth/callback/* → rate limiting uniquement (pas de guard token)
// • /mon-compte → token client requis
//
// Routes publiques intentionnelles (non incluses) :
// • GET /api/produits
// • GET /api/site-config
// • GET /api/commandes/suivi
// • POST /api/checkout
// • POST /api/webhooks/stripe
// • POST /api/client/register, /api/client/mot-de-passe-oublie, /api/client/reinitialiser-mdp
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
    '/api/upload',
    '/api/site-config',
    // Rate limiting login — TICK-052
    '/api/auth/callback/credentials',
    '/api/auth/callback/admin-credentials',
    '/api/auth/callback/client-credentials',
    // Espace client protégé
    '/mon-compte/:path*',
  ],
};

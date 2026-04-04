// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
// TICK-071 — Routes client protégées + vérification de rôle
// TICK-078 — Rate limiting endpoints auth client
// CVE-06  — CSP dynamique avec nonce par requête (suppression de unsafe-inline)
import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  checkRegisterRateLimit,
  checkForgotPasswordRateLimit,
  checkCheckoutRateLimit,
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

// ── CVE-06 : Génération CSP dynamique avec nonce par requête ───────────────
// Stratégie nonce (recommandée par OWASP / Google CSP Evaluator) :
//   • 'nonce-{nonce}'  → seuls les scripts portant ce nonce s'exécutent
//   • 'strict-dynamic' → les scripts chargés par un script noncé sont aussi autorisés
//   • 'unsafe-inline'  → ignoré par les navigateurs CSP3 (présence du nonce),
//                         conservé comme fallback pour les navigateurs CSP2
//   • 'unsafe-eval'    → uniquement en dev pour Turbopack HMR
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

    // ── Rate limiting checkout — protège le quota Stripe API ──────────────
    // 10 sessions max / 15 min par IP : couvre les retries légitimes tout en
    // bloquant les bots qui créeraient des sessions en masse.
    if (pathname === '/api/checkout' && request.method === 'POST') {
      const { success, reset } = await checkCheckoutRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Vérification de rôle : admin requis ───────────────────────────────
    // Un client connecté ne peut pas accéder aux routes admin
    const token = request.nextauth?.token;
    const isAdminRoute =
      (pathname.startsWith('/admin/') && pathname !== '/admin/login') ||
      // /api/commandes/suivi est public — on exclut explicitement ce chemin
      (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
      // CVE-02 — routes admin dédiées
      // /api/produits exclu : GET est public (menu client), POST/PUT/DELETE protégés par requireAdmin() dans les handlers
      pathname.startsWith('/api/admin/') ||
      pathname === '/api/upload';
      // /api/site-config retiré : GET est public, PUT protégé par requireAdmin() dans le handler

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

    // ── CVE-06 : Nonce CSP par requête ────────────────────────────────────
    // Un UUID aléatoire est converti en base64 pour former un nonce imprévisible.
    // Il est injecté dans l'en-tête CSP de la réponse ET dans x-nonce de la
    // requête pour que le layout (Server Component) puisse le lire via headers().
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = generateCsp(nonce);

    // Passer le nonce en avant vers les Server Components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

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

        // Routes publiques : toujours autorisées (rate limiting géré ci-dessus)
        if (pathname.startsWith('/api/auth/')) return true;
        if (pathname === '/api/client/register') return true;
        if (pathname === '/api/client/forgot-password') return true;
        // Suivi de commande public (page /confirmation — pas d'auth requise)
        if (pathname === '/api/commandes/suivi') return true;
        // Raison de refus Stripe (page commande annulée — pas d'auth requise)
        if (pathname === '/api/commandes/raison-echec') return true;
        // GET /api/produits sans ?all=true est public (menu client)
        // La vérification admin est faite dans le handler pour ?all=true

        // Routes client protégées : token requis
        const clientProtected =
          pathname === '/profil' ||
          pathname.startsWith('/api/client/profil') ||
          pathname.startsWith('/api/client/account') ||
          pathname.startsWith('/api/client/commandes') ||
          pathname.startsWith('/api/client/export');

        if (clientProtected) return !!token;

        // Routes admin dans le matcher : token requis
        // /admin/login exclu : c'est la page de connexion elle-même (sinon boucle infinie)
        // /api/produits exclu : public en GET, les handlers POST/PUT/DELETE appellent requireAdmin()
        if (pathname === '/admin/login') return true;

        const adminRoute =
          pathname.startsWith('/admin/') ||
          (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
          pathname.startsWith('/api/admin/') ||
          pathname === '/api/upload' ||
          pathname === '/api/auth/callback/credentials';

        if (adminRoute) return !!token;

        // Toutes les autres routes (pages publiques) : autorisées sans token
        return true;
      },
    },
  }
);

export const config = {
  // CVE-06 — Matcher étendu à toutes les routes pour injecter le nonce CSP
  // Exclure les assets statiques Next.js (_next/static, _next/image, fichiers publics)
  // pour éviter de ralentir inutilement la livraison des assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)',
  ],
};

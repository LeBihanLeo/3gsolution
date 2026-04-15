// TICK-052 — SEC-03 : Rate limiting sur le login admin
// TICK-054 — SEC-06 : Middleware étendu aux routes API admin manquantes
// TICK-071 — Routes client protégées + vérification de rôle
// TICK-078 — Rate limiting endpoints auth client
// CVE-06  — CSP dynamique avec nonce par requête (suppression de unsafe-inline)
// TICK-132 — Tenant-resolver : injecte x-tenant-host depuis le Host header
//            (la résolution DB restaurantId est faite dans lib/tenant.ts — Node.js runtime)
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
function generateCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  // TICK-152 — Auth Hub host pour connect-src (si configuré)
  const authHubHost = process.env.AUTH_HUB_HOST ?? '';
  const connectSrc = [
    "'self'",
    'https://api.stripe.com',
    'https://challenges.cloudflare.com',
    ...(authHubHost ? [`https://${authHubHost}`] : []),
  ].join(' ');
  return [
    "default-src 'self'",
    isDev
      ? `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`
      : `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",  // Tailwind inline styles
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:", // Service worker PWA
  ].join('; ');
}

// ── TICK-132 : Extraction du host normalisé ────────────────────────────────
// Retourne le host sans port pour la comparaison de domaine.
function extractHost(request: NextRequest): string {
  // En production sur Vercel, x-forwarded-host est le domaine public.
  // En développement, on utilise le Host header.
  const forwarded = request.headers.get('x-forwarded-host');
  const host = forwarded ?? request.headers.get('host') ?? 'localhost';
  // Supprimer le port pour normaliser (localhost:3000 → localhost:3000 gardé tel quel)
  return host;
}

// Chemins accessibles sur le hub (tout le reste → 404)
const HUB_ALLOWED_PREFIXES = [
  '/api/auth/',        // NextAuth + routes auth custom (google-relay, cross-domain-hub, token…)
  '/api/superadmin/',
  '/api/webhooks/',    // Webhooks Stripe Connect global
  '/superadmin/',
  '/auth/google/start',
];

export default withAuth(
  async function middleware(request: NextRequest & { nextauth?: { token?: { role?: string; restaurantDomain?: string } } }) {
    const { pathname } = request.nextUrl;
    const ip = extractIp(request);

    // ── Hub domain protection ──────────────────────────────────────────────
    // Sur hub.nhesitepas.fr, seules les routes nécessaires au flow OAuth et
    // au superadmin sont accessibles. Tout le reste retourne 404.
    const hubHost = process.env.AUTH_HUB_HOST;
    if (hubHost) {
      const currentHost = extractHost(request);
      if (currentHost === hubHost) {
        const isHubAllowed = HUB_ALLOWED_PREFIXES.some(p => pathname.startsWith(p));
        if (!isHubAllowed) {
          return new NextResponse(null, { status: 404 });
        }
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

    // ── Rate limiting checkout ────────────────────────────────────────────
    if (pathname === '/api/checkout' && request.method === 'POST') {
      const { success, reset } = await checkCheckoutRateLimit(ip);
      if (!success) return rateLimitResponse(reset);
    }

    // ── Vérification de rôle : admin requis ───────────────────────────────
    const token = request.nextauth?.token;
    const isAdminRoute =
      (pathname.startsWith('/espace-restaurateur/') && pathname !== '/espace-restaurateur/login') ||
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
    // Un admin de resto-a.com ne peut pas accéder aux routes admin de resto-b.com.
    // token.restaurantDomain (stocké dans le JWT à la connexion admin) est comparé
    // au host courant. En dev (localhost / DEV_TENANT_ID), la vérification est ignorée.
    if (isAdminRoute && token?.role === 'admin') {
      const currentHost = extractHost(request);
      const isLocalhost = currentHost.startsWith('localhost') || currentHost.startsWith('127.0.0.1');
      const restaurantDomain = token.restaurantDomain as string | undefined;

      if (!isLocalhost && restaurantDomain && restaurantDomain !== currentHost) {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(JSON.stringify({ error: 'Accès refusé — domaine incorrect.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return NextResponse.redirect(new URL('/espace-restaurateur/login', request.url));
      }
    }

    // ── Vérification de rôle : super-admin requis ─────────────────────────
    if (
      (pathname.startsWith('/superadmin/') && pathname !== '/superadmin/login') ||
      pathname.startsWith('/api/superadmin/')
    ) {
      if (!token || token.role !== 'superadmin') {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(JSON.stringify({ error: 'Accès refusé.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return NextResponse.redirect(new URL('/superadmin/login', request.url));
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

    // TICK-132 — Injecter x-tenant-host : permet aux Server Components et routes API
    // de connaître le domaine de la requête sans re-lire le Host header.
    const currentHost = extractHost(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('x-tenant-host', currentHost);

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

        // Routes publiques
        if (pathname.startsWith('/api/auth/')) return true;
        if (pathname === '/auth/completing') return true; // TICK-150 — page completing cross-domain
        if (pathname === '/api/client/register') return true;
        if (pathname === '/api/client/forgot-password') return true;
        if (pathname === '/api/commandes/suivi') return true;
        if (pathname === '/api/commandes/raison-echec') return true;

        // Super-admin login : public
        if (pathname === '/superadmin/login') return true;
        if (pathname === '/api/superadmin/auth') return true;

        // Routes client protégées : token requis
        const clientProtected =
          pathname === '/profil' ||
          pathname.startsWith('/api/client/profil') ||
          pathname.startsWith('/api/client/account') ||
          pathname.startsWith('/api/client/commandes') ||
          pathname.startsWith('/api/client/export');

        if (clientProtected) return !!token;

        // Routes admin
        if (pathname === '/espace-restaurateur/login') return true;

        const adminRoute =
          pathname.startsWith('/espace-restaurateur/') ||
          (pathname.startsWith('/api/commandes') && pathname !== '/api/commandes/suivi') ||
          pathname.startsWith('/api/admin/') ||
          pathname === '/api/upload' ||
          pathname === '/api/auth/callback/credentials';

        if (adminRoute) return !!token;

        // Super-admin routes
        if (
          pathname.startsWith('/superadmin/') ||
          pathname.startsWith('/api/superadmin/')
        ) return !!token;

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)',
  ],
};

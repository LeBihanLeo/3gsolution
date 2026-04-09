// TICK-147 — Intermédiaire post-Google OAuth sur le hub (Sprint 19)
// Appelé après authentification Google via callbackUrl posé par /api/auth/google-relay.
// Lit le cookie auth_return_to, crée un AuthCode, redirige vers le restaurant.
//
// Flow :
//   GET {hub}/api/auth/cross-domain-hub    (après redirect Google)
//   → getServerSession → user.email, user.id
//   → assertKnownDomain(returnTo)
//   → AuthCode.create({ code, userId, email, name, returnTo })
//   → delete cookie auth_return_to
//   → redirect {returnTo}/api/auth/cross-domain?code={code}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import AuthCode from '@/models/AuthCode';
import { assertKnownDomain } from '@/lib/auth/assert-known-domain';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    // Pas de session — l'utilisateur n'a pas complété le flow Google
    return NextResponse.redirect(new URL('/auth/login?error=google_failed', request.url));
  }

  const cookieStore = await cookies();
  const returnTo = cookieStore.get('auth_return_to')?.value;

  if (!returnTo) {
    // Pas de returnTo : flow Google direct sans cross-domain — redirige vers la page d'accueil du hub
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    await assertKnownDomain(returnTo);
  } catch (err) {
    logger.warn('cross_domain_hub_domain_rejected', { returnTo: returnTo.slice(0, 100) });
    cookieStore.delete('auth_return_to');
    return NextResponse.redirect(new URL('/auth/login?error=invalid_domain', request.url));
  }

  try {
    await connectDB();

    const code = randomBytes(32).toString('hex');
    await AuthCode.create({
      code,
      userId: (session.user as { id?: string }).id ?? session.user.email,
      email: session.user.email,
      name: session.user.name ?? undefined,
      returnTo,
    });

    cookieStore.delete('auth_return_to');

    logger.info('auth_code_issued', { hostname: new URL(returnTo).hostname });

    const redirectUrl = new URL('/api/auth/cross-domain', returnTo);
    redirectUrl.searchParams.set('code', code);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    logger.error('cross_domain_hub_failed', {}, err);
    return NextResponse.redirect(new URL('/auth/login?error=server_error', request.url));
  }
}

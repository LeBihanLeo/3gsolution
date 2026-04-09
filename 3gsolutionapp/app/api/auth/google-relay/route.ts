// TICK-146 — Point d'entrée du flow OAuth cross-domain (Sprint 19)
// Le bouton Google sur resto-a.com redirige ici (sur le hub) au lieu de signIn('google') direct.
// Cette route valide returnTo, pose un cookie httpOnly, puis lance le flow Google OAuth standard.
import { NextRequest, NextResponse } from 'next/server';
import { assertKnownDomain } from '@/lib/auth/assert-known-domain';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const returnTo = searchParams.get('returnTo');

  if (!returnTo) {
    return NextResponse.json({ error: 'Paramètre returnTo manquant.' }, { status: 400 });
  }

  try {
    await assertKnownDomain(returnTo);
  } catch (err) {
    logger.warn('google_relay_domain_rejected', { returnTo: returnTo.slice(0, 100) });
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 403 }
    );
  }

  let hostname: string;
  try {
    hostname = new URL(returnTo).hostname;
  } catch {
    return NextResponse.json({ error: 'returnTo invalide.' }, { status: 400 });
  }

  logger.info('google_relay_initiated', { hostname });

  // Cookie httpOnly stockant le domaine de retour — lu par /api/auth/cross-domain-hub après Google auth
  // callbackUrl pointe vers cross-domain-hub qui crée l'AuthCode et redirige vers le restaurant
  const signinUrl = new URL('/api/auth/signin/google', request.url);
  signinUrl.searchParams.set('callbackUrl', '/api/auth/cross-domain-hub');

  const response = NextResponse.redirect(signinUrl);

  response.cookies.set('auth_return_to', returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  return response;
}

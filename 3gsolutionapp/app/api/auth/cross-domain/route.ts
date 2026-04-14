// TICK-149 — Réception côté restaurant du code cross-domain (Sprint 19)
// Reçoit le code depuis le hub, l'échange server-to-server, crée un RelayToken,
// puis redirige vers /auth/completing pour créer la session NextAuth.
//
// Flow :
//   Browser → GET /api/auth/cross-domain?code=abc123 (sur resto-a.com)
//   → Server: POST {AUTH_HUB_URL}/api/auth/token { code }  (avec INTER_SERVICE_SECRET)
//   → Reçoit { userId, email, name }
//   → RelayToken.create({ token, userId, email, name }) — TTL 10s
//   → Redirect vers /auth/completing?t={relayToken}
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { connectDB } from '@/lib/mongodb';
import RelayToken from '@/models/RelayToken';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Utilise Host header pour construire les URLs de redirection — request.url peut retourner
  // localhost:3000 sur Vercel/proxy (même pattern que TICK-142).
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const base = `${proto}://${host}`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid', base));
  }

  const authHubUrl = process.env.AUTH_HUB_URL;
  const interServiceSecret = process.env.INTER_SERVICE_SECRET;

  if (!authHubUrl || !interServiceSecret) {
    logger.error('cross_domain_exchange_failed', { error: 'AUTH_HUB_URL ou INTER_SERVICE_SECRET manquants' });
    return NextResponse.redirect(new URL('/auth/login?error=server_error', base));
  }

  // ── Échange server-to-server avec timeout 5s ──────────────────────────
  let userData: { userId: string; email: string; name?: string | null };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${authHubUrl}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${interServiceSecret}`,
      },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('cross_domain_exchange_failed', { status: response.status });
      return NextResponse.redirect(new URL('/auth/login?error=expired', base));
    }

    userData = await response.json();
  } catch (err) {
    logger.error('cross_domain_exchange_failed', { error: 'fetch error' }, err);
    return NextResponse.redirect(new URL('/auth/login?error=expired', base));
  }

  // ── Création du RelayToken (TTL 10s) ──────────────────────────────────
  try {
    await connectDB();

    const token = randomBytes(32).toString('hex');
    await RelayToken.create({
      token,
      userId: userData.userId,
      email: userData.email,
      name: userData.name ?? undefined,
    });

    logger.info('cross_domain_exchange_success', { email: userData.email });

    return NextResponse.redirect(
      new URL(`/auth/completing?t=${token}`, base)
    );
  } catch (err) {
    logger.error('cross_domain_relay_token_failed', {}, err);
    return NextResponse.redirect(new URL('/auth/login?error=server_error', base));
  }
}

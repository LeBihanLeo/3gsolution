// TICK-148 — Échange server-to-server : AuthCode → données utilisateur (Sprint 19)
// Appelé uniquement par le serveur restaurant (jamais par le navigateur).
// Protégé par INTER_SERVICE_SECRET — refuse sans le header Authorization correct.
// findOneAndDelete atomique : garantit usage unique sans race condition.
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuthCode from '@/models/AuthCode';
import { logger } from '@/lib/logger';
import { checkTokenRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  // ── Rate limiting : max 20 req/min par IP ──────────────────────────────
  const ip =
    (req as NextRequest & { ip?: string }).ip ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1';
  const { success, reset } = await checkTokenRateLimit(ip);
  if (!success) {
    const retryAfter = Math.max(0, reset - Math.floor(Date.now() / 1000));
    return Response.json(
      { error: 'Trop de tentatives.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // ── Vérification secret inter-services ────────────────────────────────
  const interServiceSecret = process.env.INTER_SERVICE_SECRET;
  if (!interServiceSecret) {
    logger.error('auth_token_exchange', { error: 'INTER_SERVICE_SECRET manquant' });
    return Response.json({ error: 'Configuration serveur incorrecte.' }, { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${interServiceSecret}`) {
    logger.warn('auth_token_exchange_unauthorized', { ip });
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Lecture et validation du body ─────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { code } = body as { code?: unknown };
  if (!code || typeof code !== 'string') {
    return Response.json({ error: 'code requis.' }, { status: 400 });
  }

  // ── Échange atomique : lit ET supprime en une opération ───────────────
  await connectDB();
  const authCode = await AuthCode.findOneAndDelete({ code });

  if (!authCode) {
    logger.warn('auth_token_exchange_invalid', { ip });
    return Response.json({ error: 'Code invalide ou expiré.' }, { status: 401 });
  }

  logger.info('auth_token_exchange_success', { email: authCode.email });

  // Ne retourner que les champs nécessaires — jamais de données sensibles
  return Response.json({
    userId: authCode.userId,
    email: authCode.email,
    name: authCode.name ?? null,
  });
}

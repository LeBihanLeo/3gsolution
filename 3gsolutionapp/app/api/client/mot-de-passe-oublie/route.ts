import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import PasswordResetToken from '@/models/PasswordResetToken';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit, RATE_LIMIT_PWD_RESET } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const ip =
    (request as NextRequest & { ip?: string }).ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1';

  // Rate limiting strict — 3 demandes / heure / IP (évite le flood d'emails)
  const { success, reset } = await checkRateLimit(ip, RATE_LIMIT_PWD_RESET);
  if (!success) {
    const retryAfter = Math.max(0, reset - Math.floor(Date.now() / 1000));
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  // Réponse identique qu'un compte existe ou non — évite l'énumération d'emails
  // (OWASP A07:2021)
  const GENERIC_RESPONSE = NextResponse.json({ ok: true });

  await connectDB();
  const client = await Client.findOne({
    email: parsed.data.email.toLowerCase(),
    actif: true,
    provider: 'credentials', // uniquement pour les comptes avec mot de passe
  });

  if (!client) return GENERIC_RESPONSE;

  // Générer un token cryptographiquement sûr
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

  await PasswordResetToken.create({
    clientId: client._id,
    tokenHash,
    expiresAt,
    used: false,
  });

  try {
    await sendPasswordResetEmail(client.email, rawToken);
    logger.info({ event: 'pwd_reset_requested', clientId: client._id.toString() });
  } catch (err) {
    logger.error({ event: 'pwd_reset_email_failed', clientId: client._id.toString(), err });
    // On retourne quand même 200 — ne pas révéler l'état du service email
  }

  return GENERIC_RESPONSE;
}

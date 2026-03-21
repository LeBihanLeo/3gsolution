import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import PasswordResetToken from '@/models/PasswordResetToken';
import { checkRateLimit, RATE_LIMIT_PWD_CONFIRM } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

function glidingPurgeAt(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 36);
  return d;
}

export async function POST(request: NextRequest) {
  const ip =
    (request as NextRequest & { ip?: string }).ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1';

  const { success, reset } = await checkRateLimit(ip, RATE_LIMIT_PWD_CONFIRM);
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
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { token: rawToken, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await connectDB();

  // Consommation atomique — anti-replay : used passe à true en une seule opération
  const prt = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    },
    { $set: { used: true } },
    { new: true }
  );

  if (!prt) {
    return NextResponse.json(
      { error: 'Lien invalide ou expiré. Veuillez refaire une demande.' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  await Client.updateOne(
    { _id: prt.clientId },
    {
      $set: {
        passwordHash,
        lastLoginAt: now,
        purgeAt: glidingPurgeAt(),
      },
    }
  );

  logger.info({ event: 'pwd_reset_completed', clientId: prt.clientId.toString() });

  return NextResponse.json({ ok: true });
}

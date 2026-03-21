import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import { checkRateLimit, RATE_LIMIT_REGISTER } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

const RegisterSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  consentement: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement est obligatoire' }),
  }),
});

export async function POST(request: NextRequest) {
  const ip =
    (request as NextRequest & { ip?: string }).ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    '127.0.0.1';

  // Rate limiting
  const { success, reset } = await checkRateLimit(ip, RATE_LIMIT_REGISTER);
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

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { nom, email, password } = parsed.data;

  await connectDB();

  const existing = await Client.findOne({ email });
  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const purgeAt = new Date(now);
  purgeAt.setMonth(purgeAt.getMonth() + 36);

  const client = await Client.create({
    email,
    nom,
    passwordHash,
    provider: 'credentials',
    actif: true,
    consentementMarketing: false,
    consentementDate: now,
    lastLoginAt: now,
    purgeAt,
  });

  logger.info({ event: 'client_registered', clientId: client._id.toString(), provider: 'credentials' });

  return NextResponse.json({ ok: true }, { status: 201 });
}

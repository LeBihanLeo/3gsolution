// TICK-138 — Super-admin auth : login (POST) / logout (DELETE)
// Protection : SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD_HASH (bcrypt)
// Stockage session : cookie httpOnly "superadmin_token" (JWT HS256, audience "superadmin")
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signSuperadminToken } from '@/lib/superadmin-jwt';

const COOKIE_NAME = 'superadmin_token';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 heures

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs email et password requis.' }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  const superadminHash = process.env.SUPERADMIN_PASSWORD_HASH;

  if (!superadminEmail || !superadminHash) {
    return NextResponse.json(
      { error: 'Super-admin non configuré sur ce serveur.' },
      { status: 503 }
    );
  }

  // Comparaison email insensible à la casse
  if (email.toLowerCase() !== superadminEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, superadminHash);
  if (!isValid) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
  }

  const token = await signSuperadminToken(email.toLowerCase());

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

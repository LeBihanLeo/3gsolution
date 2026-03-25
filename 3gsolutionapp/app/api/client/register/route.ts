// TICK-067 — POST /api/client/register
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import { sendVerificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  // TICK-087 — nom obligatoire
  nom: z.string().min(1, 'Le nom est requis').max(50),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 majuscule')
    .regex(/[a-z]/, 'Au moins 1 minuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins 1 caractère spécial'),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, nom, password } = parsed.data; // nom est désormais obligatoire (TICK-087)
  const normalizedEmail = email.toLowerCase();

  logger.info('client_register_attempt', { email: normalizedEmail });

  await connectDB();

  const existing = await Client.findOne({ email: normalizedEmail });
  if (existing) {
    return NextResponse.json(
      { error: 'Un compte existe déjà avec cet email.' },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');
  const emailVerifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await Client.create({
    email: normalizedEmail,
    nom,
    passwordHash,
    provider: 'credentials',
    emailVerified: false,
    emailVerifyToken,
    emailVerifyTokenExpiry,
  });

  try {
    await sendVerificationEmail(normalizedEmail, emailVerifyToken);
  } catch (err) {
    logger.error('client_register_email_failed', { email: normalizedEmail }, err);
    // Non-bloquant : le compte est créé, l'email peut être renvoyé plus tard
  }

  logger.info('client_register_success', { email: normalizedEmail });

  return NextResponse.json(
    { message: 'Compte créé. Vérifiez votre email pour activer votre compte.' },
    { status: 201 }
  );
}

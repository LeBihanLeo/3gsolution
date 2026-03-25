// TICK-069 — POST /api/client/reset-password
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import { logger } from '@/lib/logger';

const ResetSchema = z.object({
  token: z.string().min(1),
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

  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  await connectDB();

  const client = await Client.findOne({ passwordResetToken: token });

  if (!client || !client.passwordResetTokenExpiry || client.passwordResetTokenExpiry < new Date()) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await Client.updateOne(
    { _id: client._id },
    {
      $set: { passwordHash },
      $unset: { passwordResetToken: '', passwordResetTokenExpiry: '' },
    }
  );

  logger.info('password_reset_success', { clientId: client._id.toString() });

  return NextResponse.json({ message: 'Mot de passe réinitialisé avec succès.' });
}

// TICK-069 — POST /api/client/forgot-password
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import { sendPasswordResetEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Retour 200 dans tous les cas — évite l'énumération d'emails
    return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });
  }

  const email = (body as { email?: unknown }).email;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });
  }

  const normalizedEmail = email.toLowerCase();

  // Log sans exposer l'email en production
  logger.info('password_reset_requested', {
    ...(process.env.NODE_ENV !== 'production' && { email: normalizedEmail }),
  });

  await connectDB();

  const client = await Client.findOne({ email: normalizedEmail });

  // Compte Google ou inexistant → pas d'email envoyé, réponse identique
  if (client && client.provider === 'credentials') {
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // +1h

    await Client.updateOne(
      { _id: client._id },
      { $set: { passwordResetToken, passwordResetTokenExpiry } }
    );

    try {
      await sendPasswordResetEmail(normalizedEmail, passwordResetToken);
    } catch (err) {
      logger.error('password_reset_email_failed', {}, err);
    }
  }

  return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });
}

// TICK-185 — Confirmation du premier code TOTP + sauvegarde du secret en DB
// POST /api/admin/2fa/confirm  { secret: string, code: string }
// Valide le code contre le secret, puis active le 2FA sur le compte admin.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ConfirmSchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  const { secret, code } = parsed.data;
  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) {
    return NextResponse.json({ error: 'Code incorrect ou expiré.' }, { status: 400 });
  }

  await connectDB();
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId;
  await Restaurant.findByIdAndUpdate(restaurantId, { adminTotpSecret: secret });

  logger.info('admin_2fa_enabled', { restaurantId });
  return NextResponse.json({ ok: true });
}

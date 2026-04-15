// TICK-185 — Désactivation du 2FA admin (code TOTP requis pour prouver la possession)
// POST /api/admin/2fa/disable  { code: string }
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

const DisableSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = DisableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides.' }, { status: 400 });
  }

  await connectDB();
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId;
  const restaurant = await Restaurant.findById(restaurantId)
    .select('+adminTotpSecret')
    .lean();

  if (!restaurant?.adminTotpSecret) {
    return NextResponse.json({ error: '2FA non activé.' }, { status: 400 });
  }

  const isValid = authenticator.verify({ token: parsed.data.code, secret: restaurant.adminTotpSecret });
  if (!isValid) {
    return NextResponse.json({ error: 'Code incorrect ou expiré.' }, { status: 400 });
  }

  await Restaurant.findByIdAndUpdate(restaurantId, { $unset: { adminTotpSecret: '' } });

  logger.info('admin_2fa_disabled', { restaurantId });
  return NextResponse.json({ ok: true });
}

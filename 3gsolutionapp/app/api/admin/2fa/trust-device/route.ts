// TICK-185 — Pose du cookie "appareil de confiance" après validation TOTP réussie
// POST /api/admin/2fa/trust-device
// Cookie : device_trust_admin — httpOnly, SameSite=Strict, Secure, 30 jours
// Valeur : restaurantId.issuedAt.HMAC-SHA256(restaurantId:issuedAt, NEXTAUTH_SECRET)
// Validation côté authorize() sans accès DB (pur crypto).
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createHmac } from 'crypto';
import { authOptions } from '@/lib/auth';

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

export function buildDeviceToken(restaurantId: string, issuedAt: number): string {
  const hmac = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(`${restaurantId}:${issuedAt}`)
    .digest('hex');
  return `${restaurantId}.${issuedAt}.${hmac}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const restaurantId = (session.user as { restaurantId?: string }).restaurantId ?? '';
  const issuedAt = Date.now();
  const token = buildDeviceToken(restaurantId, issuedAt);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('device_trust_admin', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: THIRTY_DAYS_S,
    path: '/espace-restaurateur',
  });

  return response;
}

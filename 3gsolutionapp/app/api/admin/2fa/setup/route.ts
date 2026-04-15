// TICK-185 — Génération du secret TOTP + QR code (SVG) pour l'activation 2FA admin
// POST /api/admin/2fa/setup
// Retourne { secret, qrCodeSvg } — le secret n'est PAS encore sauvegardé en DB.
// L'admin doit confirmer avec un premier code valide via /api/admin/2fa/confirm.
// Note : toString({ type: 'svg' }) ne nécessite pas le package canvas — compatible Node.js.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import QRCode from 'qrcode';
import { generateTotpSecret, totpKeyUri } from '@/lib/totp';
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const email = session.user?.email ?? 'admin';
  const otpauth = totpKeyUri(secret, email, 'Espace Restaurateur');
  const qrCodeSvg = await QRCode.toString(otpauth, { type: 'svg' });

  return NextResponse.json({ secret, qrCodeSvg });
}

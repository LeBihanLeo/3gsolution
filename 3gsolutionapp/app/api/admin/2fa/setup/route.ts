// TICK-185 — Génération du secret TOTP + QR code pour l'activation 2FA admin
// POST /api/admin/2fa/setup
// Retourne { secret, qrCodeDataUrl } — le secret n'est PAS encore sauvegardé en DB.
// L'admin doit confirmer avec un premier code valide via /api/admin/2fa/confirm.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const secret = authenticator.generateSecret(20);
  const email = session.user?.email ?? 'admin';
  const otpauth = authenticator.keyuri(email, 'Espace Restaurateur', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ secret, qrCodeDataUrl });
}

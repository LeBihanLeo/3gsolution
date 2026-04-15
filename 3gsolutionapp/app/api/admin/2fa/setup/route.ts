// TICK-185 — Génération du secret TOTP pour l'activation 2FA admin
// POST /api/admin/2fa/setup
// Retourne { secret, otpauthUri } — aucune dépendance externe.
// Le secret n'est PAS encore sauvegardé en DB.
// L'admin confirme avec un premier code valide via /api/admin/2fa/confirm.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateTotpSecret, totpKeyUri } from '@/lib/totp';
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const email = session.user?.email ?? 'admin';
  const otpauthUri = totpKeyUri(secret, email, 'Espace Restaurateur');

  return NextResponse.json({ secret, otpauthUri });
}

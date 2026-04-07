// TICK-138 — Guard superadmin pour les API routes (Node.js runtime)
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySuperadminToken } from '@/lib/superadmin-jwt';

type GuardOk = { email: string; error: null };
type GuardFail = { email: null; error: NextResponse };

export async function requireSuperadmin(): Promise<GuardOk | GuardFail> {
  const cookieStore = await cookies();
  const token = cookieStore.get('superadmin_token')?.value;

  if (!token) {
    return {
      email: null,
      error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }),
    };
  }

  const payload = await verifySuperadminToken(token);
  if (!payload) {
    return {
      email: null,
      error: NextResponse.json({ error: 'Token invalide ou expiré.' }, { status: 401 }),
    };
  }

  return { email: payload.email, error: null };
}

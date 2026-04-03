// TICK-072 — PATCH /api/client/profil
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

const SELECT = '-passwordHash -emailVerifyToken -emailVerifyTokenExpiry -passwordResetToken -passwordResetTokenExpiry';

const PatchSchema = z.object({
  nom: z.string().min(1).max(50).optional(),
  // Digits only : 10 chiffres commençant par 0, ou chaîne vide pour effacer
  telephone: z.union([
    z.string().regex(/^0[1-9]\d{8}$/, 'Numéro invalide (10 chiffres, ex : 0612345678)'),
    z.literal(''),
  ]).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  await connectDB();

  const client = await Client.findById(session.user.id).select(SELECT).lean();

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ client });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const update: Record<string, string> = {};
  if (parsed.data.nom) update.nom = parsed.data.nom;
  if (parsed.data.telephone !== undefined) update.telephone = parsed.data.telephone;

  await connectDB();

  const client = await Client.findByIdAndUpdate(
    session.user.id,
    { $set: update },
    { new: true, select: SELECT }
  );

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ client });
}

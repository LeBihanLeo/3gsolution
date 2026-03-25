// TICK-072 — PATCH /api/client/profil
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

const PatchSchema = z.object({
  nom: z.string().min(1).max(50),
});

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

  await connectDB();

  const client = await Client.findByIdAndUpdate(
    session.user.id,
    { $set: { nom: parsed.data.nom } },
    { new: true, select: '-passwordHash -emailVerifyToken -emailVerifyTokenExpiry -passwordResetToken -passwordResetTokenExpiry' }
  );

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ client });
}

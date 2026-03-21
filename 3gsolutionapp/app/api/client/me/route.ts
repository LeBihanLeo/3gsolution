import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';
import mongoose from 'mongoose';

function clientGuard(session: Awaited<ReturnType<typeof getServerSession>>) {
  return session?.user?.role === 'client' || session?.user?.role === 'admin';
}

// ── GET /api/client/me ────────────────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!clientGuard(session)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  await connectDB();
  const client = await Client.findById(session!.user.id, '-passwordHash -googleId').lean();
  if (!client) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  return NextResponse.json(client);
}

// ── PATCH /api/client/me ──────────────────────────────────────────────────────
const PatchSchema = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  consentementMarketing: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!clientGuard(session)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  await connectDB();
  await Client.updateOne({ _id: session!.user.id }, { $set: parsed.data });

  logger.info({ event: 'client_profile_updated', clientId: session!.user.id });

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/client/me — RGPD Art. 17 (droit à l'effacement) ──────────────
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!clientGuard(session)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const clientId = session!.user.id;
  await connectDB();

  // 1. Anonymiser les commandes liées (conservation comptable — données PII supprimées)
  await Commande.updateMany(
    { clientId: new mongoose.Types.ObjectId(clientId) },
    {
      $unset: { clientId: '' },
      $set: {
        'client.nom': '[Supprimé]',
        'client.telephone': '[Supprimé]',
        'client.email': '[Supprimé]',
      },
    }
  );

  // 2. Soft-delete : libérer l'email unique + effacer les PII
  //    L'email est remplacé pour libérer la contrainte unique (ré-inscription possible)
  const anonymisedEmail = `[supprimé-${Date.now()}]`;
  await Client.updateOne(
    { _id: clientId },
    {
      $set: {
        actif: false,
        email: anonymisedEmail,
        nom: '[Supprimé]',
      },
      $unset: { passwordHash: '', googleId: '' },
    }
  );

  logger.warn({ event: 'client_deleted_gdpr', clientId });

  return NextResponse.json({ ok: true });
}

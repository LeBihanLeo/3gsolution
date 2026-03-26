import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import Commande from '@/models/Commande';

// TICK-099 — Transitions valides admin
const TRANSITIONS: Record<string, string> = {
  payee: 'en_preparation',
  en_preparation: 'prete',
  prete: 'recuperee',
};

const StatutSchema = z.object({
  statut: z.enum(['en_preparation', 'prete', 'recuperee']),
});

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/commandes/[id]/statut — admin : faire avancer le statut d'une commande
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = StatutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Statut invalide. Valeurs acceptées : en_preparation, prete, recuperee' },
        { status: 400 }
      );
    }

    const { statut: newStatut } = parsed.data;

    await connectDB();
    const commande = await Commande.findById(id);

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const expectedNewStatut = TRANSITIONS[commande.statut];
    if (expectedNewStatut !== newStatut) {
      return NextResponse.json(
        { error: `Transition invalide : ${commande.statut} → ${newStatut}` },
        { status: 422 }
      );
    }

    commande.statut = newStatut;
    await commande.save();

    return NextResponse.json({ data: commande });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

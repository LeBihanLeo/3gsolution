import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import Commande from '@/models/Commande';

const StatutSchema = z.object({
  statut: z.literal('prete'),
});

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/commandes/[id]/statut — admin : passer une commande à "prête"
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
        { error: 'Seul le statut "prete" est accepté via cette route' },
        { status: 400 }
      );
    }

    await connectDB();
    const commande = await Commande.findByIdAndUpdate(
      id,
      { statut: 'prete' },
      { new: true }
    );

    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: commande });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

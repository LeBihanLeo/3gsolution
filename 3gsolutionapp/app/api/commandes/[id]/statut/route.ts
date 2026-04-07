import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import Commande from '@/models/Commande';
import { resolveTenantForAdmin } from '@/lib/tenant';

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
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

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
    // TICK-134 — Filtrage cross-tenant
    const commande = await Commande.findOne({ _id: id, restaurantId });

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
    const now = new Date();
    if (newStatut === 'en_preparation') commande.enPreparationAt = now;
    if (newStatut === 'prete') commande.preteAt = now;
    if (newStatut === 'recuperee') commande.recupereeAt = now;
    await commande.save();

    return NextResponse.json({ data: commande });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

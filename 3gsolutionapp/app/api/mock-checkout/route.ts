// TICK-055 — SEC-07 : Endpoint mock sécurisé (développement/staging uniquement)
// Double guard :
//   1. NODE_ENV !== 'production'  (principal — ne peut pas être oublié)
//   2. STRIPE_SECRET_KEY absent   (secondaire — cohérence avec le reste du flux mock)
import { NextRequest, NextResponse } from 'next/server';
import { mockSessions } from '@/lib/mockStore';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';

// Endpoint de confirmation de paiement en mode mock (développement uniquement)
// Appelé par la page /mock-checkout après clic sur "Payer"

export async function POST(request: NextRequest) {
  // Guard 1 : désactivé en production, quelle que soit la config Stripe
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Mode mock désactivé en production' }, { status: 403 });
  }

  // Guard 2 : désactivé si Stripe est configuré (cohérence avec /api/checkout)
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Mode mock désactivé (Stripe configuré)' }, { status: 403 });
  }

  const { sessionId } = await request.json();
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId manquant' }, { status: 400 });
  }

  const data = mockSessions.get(sessionId);
  if (!data) {
    return NextResponse.json({ error: 'Session introuvable ou expirée' }, { status: 404 });
  }

  try {
    await connectDB();

    // Idempotence
    const existing = await Commande.findOne({ stripeSessionId: sessionId });
    if (existing) {
      mockSessions.delete(sessionId);
      return NextResponse.json({ ok: true });
    }

    const total = data.produits.reduce(
      (sum, p) =>
        sum + (p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite,
      0
    );

    // TICK-057 — RGPD Art. 5(1)(e) : durée de rétention 12 mois
    const purgeAt = new Date();
    purgeAt.setFullYear(purgeAt.getFullYear() + 1);

    await Commande.create({
      stripeSessionId: sessionId,
      statut: 'payee',
      client: data.client,
      retrait: data.retrait,
      produits: data.produits,
      ...(data.commentaire ? { commentaire: data.commentaire } : {}),
      total,
      purgeAt,
      // TICK-075 — lier la commande au compte client si connecté
      ...(data.clientId ? { clientId: data.clientId } : {}),
    });

    mockSessions.delete(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // TICK-064 — NEW-08 : logger structuré pour cohérence avec le reste des routes API
    logger.error('mock_checkout_failed', { sessionId }, error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { mockSessions } from '@/lib/mockStore';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';

// Endpoint de confirmation de paiement en mode mock (développement uniquement)
// Appelé par la page /mock-checkout après clic sur "Payer"

export async function POST(request: NextRequest) {
  // Sécurité : refuser en production
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Mode mock désactivé' }, { status: 403 });
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

    await Commande.create({
      stripeSessionId: sessionId,
      statut: 'payee',
      client: data.client,
      retrait: data.retrait,
      produits: data.produits,
      ...(data.commentaire ? { commentaire: data.commentaire } : {}),
      total,
    });

    mockSessions.delete(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Mock checkout error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

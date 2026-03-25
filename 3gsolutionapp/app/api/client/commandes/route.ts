// TICK-076 — GET /api/client/commandes : historique des commandes du client connecté
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';

// Champs exposés — NE PAS exposer client.telephone ni client.email (RGPD)
const PROJECTION = {
  _id: 1,
  statut: 1,
  produits: 1,
  total: 1,
  retrait: 1,
  createdAt: 1,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const clientId = session.user.id;

  try {
    await connectDB();

    const commandes = await Commande.find({ clientId }, PROJECTION)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const enCours = commandes.filter(
      (c) => c.statut === 'en_attente_paiement' || c.statut === 'payee'
    );
    const passees = commandes.filter((c) => c.statut === 'prete').slice(0, 50);

    return NextResponse.json({ enCours, passees });
  } catch (err) {
    logger.error('client_commandes_fetch_failed', { clientId }, err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

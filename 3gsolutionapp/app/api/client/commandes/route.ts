// TICK-076 — GET /api/client/commandes : historique des commandes du client connecté
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';
import { getTenantId } from '@/lib/tenant';

// Champs exposés — NE PAS exposer client.telephone ni client.email (RGPD)
const PROJECTION = {
  _id: 1,
  statut: 1,
  produits: 1,
  total: 1,
  retrait: 1,
  createdAt: 1,
  receiptUrl: 1,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const clientId = session.user.id;

  try {
    // TICK-134 — scope par tenant
    const restaurantId = await getTenantId().catch(() => null);

    await connectDB();

    // TICK-099 — enCours : tous les statuts non terminaux
    // TICK-098 — limit 200 pour la page historique complète
    // TICK-134 — filtrage cross-tenant : clientId + restaurantId
    const filtre = restaurantId ? { clientId, restaurantId } : { clientId };
    const commandes = await Commande.find(filtre, PROJECTION)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const enCours = commandes.filter((c) =>
      ['en_attente_paiement', 'payee', 'en_preparation', 'prete'].includes(c.statut)
    );
    // TICK-099 — passees : uniquement "recuperee" (cycle de vie terminé)
    const passees = commandes.filter((c) => c.statut === 'recuperee');

    return NextResponse.json({ enCours, passees });
  } catch (err) {
    logger.error('client_commandes_fetch_failed', { clientId }, err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

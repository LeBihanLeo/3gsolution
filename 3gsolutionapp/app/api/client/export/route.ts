// TICK-081 — Export de données RGPD (droit à la portabilité — Art. 20 RGPD)
// TICK-140 — Multi-tenant : export toutes commandes du client (tous restaurants) + nomRestaurant
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const clientId = session.user.id;

  try {
    await connectDB();

    // Récupérer le compte client — exclure les champs sensibles
    const client = await Client.findById(clientId)
      .select('-passwordHash -emailVerifyToken -emailVerifyTokenExpiry -passwordResetToken -passwordResetTokenExpiry')
      .lean();

    if (!client) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }

    // Récupérer TOUTES les commandes du client (tous restaurants) — RGPD Art. 20 : portabilité totale
    // populate restaurantId pour inclure le nom du restaurant dans l'export
    const commandes = await Commande.find({ clientId })
      .select('_id createdAt statut produits total retrait restaurantId')
      .populate<{ restaurantId: { nom: string } | null }>('restaurantId', 'nom')
      .sort({ createdAt: -1 })
      .lean();

    const payload = {
      exportDate: new Date().toISOString(),
      compte: {
        email: client.email,
        nom: client.nom,
        telephone: client.telephone ?? null,
        provider: client.provider,
        createdAt: client.createdAt,
      },
      commandes: commandes.map((c) => ({
        id: String(c._id),
        date: c.createdAt,
        statut: c.statut,
        produits: c.produits,
        total: c.total,
        retrait: c.retrait,
        restaurant: (c.restaurantId as unknown as { nom?: string } | null)?.nom ?? null,
      })),
    };

    logger.info('client_data_exported', { clientId });

    const json = JSON.stringify(payload, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="mes-donnees-3g.json"',
      },
    });
  } catch (err) {
    logger.error('client_export_failed', { clientId }, err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

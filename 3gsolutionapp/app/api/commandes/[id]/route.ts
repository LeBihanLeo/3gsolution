// TICK-057 — RGPD Art. 17 : Droit à l'effacement (admin uniquement)
// DELETE /api/commandes/[id]
// Anonymise les PII (nom, téléphone, email) de la commande.
// La commande reste en base pour la traçabilité comptable.
// Seules les commandes au statut "prete" peuvent être anonymisées.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';
import mongoose from 'mongoose';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }

  try {
    await connectDB();

    const commande = await Commande.findById(id);
    if (!commande) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // Seules les commandes terminées ("prete") peuvent être anonymisées
    // pour éviter de supprimer des données nécessaires au traitement en cours
    if (commande.statut !== 'prete') {
      return NextResponse.json(
        { error: 'Seules les commandes au statut "prête" peuvent être supprimées' },
        { status: 409 }
      );
    }

    // Anonymisation des PII — on conserve la commande pour la traçabilité
    await Commande.updateOne(
      { _id: id },
      {
        $set: {
          'client.nom': '[Supprimé]',
          'client.telephone': '[Supprimé]',
          'client.email': undefined,
          commentaire: undefined,
        },
        $unset: {
          'client.email': '',
          commentaire: '',
        },
      }
    );

    // TICK-060 — RGPD Art. 5(2) accountability : traçabilité des anonymisations
    logger.info('commande_anonymisee', { commandeId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // TICK-060 — log structuré pour le forensic RGPD
    logger.error('anonymisation_failed', { commandeId: id }, error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

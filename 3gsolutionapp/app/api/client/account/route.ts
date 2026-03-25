// TICK-072 — DELETE /api/client/account
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Commande from '@/models/Commande';
import { logger } from '@/lib/logger';

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const clientId = session.user.id;

  await connectDB();

  // Anonymiser toutes les commandes du client (RGPD Art. 17)
  await Commande.updateMany(
    { clientId },
    {
      $set: {
        'client.nom': '[Supprimé]',
        'client.telephone': '[Supprimé]',
        'client.email': '[Supprimé]',
        clientId: null,
      },
    }
  );

  // Supprimer le document Client
  await Client.deleteOne({ _id: clientId });

  logger.info('compte_client_supprime', { clientId });

  return NextResponse.json({ message: 'Compte supprimé.' });
}

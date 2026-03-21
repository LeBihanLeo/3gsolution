import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Commande from '@/models/Commande';
import mongoose from 'mongoose';
import MonCompteClient from '@/components/client/MonCompteClient';

export const metadata = { title: 'Mon compte' };

export default async function MonComptePage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user.role !== 'client' && session.user.role !== 'admin')) {
    redirect('/connexion?redirect=/mon-compte');
  }

  await connectDB();

  const [client, commandes] = await Promise.all([
    Client.findById(session.user.id, '-passwordHash -googleId').lean(),
    Commande.find(
      { clientId: new mongoose.Types.ObjectId(session.user.id) },
      '-stripeSessionId -purgeAt'
    )
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!client) {
    redirect('/connexion');
  }

  return (
    <MonCompteClient
      client={JSON.parse(JSON.stringify(client))}
      commandes={JSON.parse(JSON.stringify(commandes))}
    />
  );
}

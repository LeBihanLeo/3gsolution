import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import mongoose from 'mongoose';

// ── GET /api/client/commandes — historique de commandes du client connecté ────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'client' && session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  await connectDB();
  const commandes = await Commande.find(
    { clientId: new mongoose.Types.ObjectId(session.user.id) },
    '-stripeSessionId -purgeAt'  // ne pas exposer les champs internes
  )
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(commandes);
}

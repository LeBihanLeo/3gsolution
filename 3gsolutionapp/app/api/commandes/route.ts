import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import Commande from '@/models/Commande';

// GET /api/commandes — admin : liste toutes les commandes triées par date DESC
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    await connectDB();
    const commandes = await Commande.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: commandes });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

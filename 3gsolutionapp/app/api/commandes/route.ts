import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import Commande from '@/models/Commande';

// GET /api/commandes — admin : liste toutes les commandes triées par date DESC
export async function GET() {
  // CVE-02 — vérification de rôle 'admin' (pas seulement "authentifié")
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    await connectDB();
    const commandes = await Commande.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: commandes });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// TICK-134 — Scoping commandes par restaurantId (multi-tenant)
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import { getTenantId } from '@/lib/tenant';
import Commande from '@/models/Commande';

// GET /api/commandes — admin : liste toutes les commandes du tenant courant, triées par date DESC
export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const restaurantId = await getTenantId();
    await connectDB();
    const commandes = await Commande.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: commandes });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

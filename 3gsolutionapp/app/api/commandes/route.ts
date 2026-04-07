import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import Commande from '@/models/Commande';
import { resolveTenantForAdmin } from '@/lib/tenant';

// GET /api/commandes — admin : liste toutes les commandes du tenant courant (triées par date DESC)
export async function GET() {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

    await connectDB();
    // TICK-134 — Filtrage par restaurantId (isolation cross-tenant)
    const commandes = await Commande.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ data: commandes });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// TICK-162 — Statut Stripe Connect pour la page admin restaurant
// GET /api/admin/stripe-status
// Retourne le statut de connexion Stripe du restaurant courant (admin uniquement).
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; restaurantId?: string } | undefined;

  if (!user || user.role !== 'admin' || !user.restaurantId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  await connectDB();
  const restaurant = await Restaurant.findById(user.restaurantId)
    .select('stripeAccountId stripeOnboardingComplete nom')
    .lean();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    connected: restaurant.stripeOnboardingComplete === true,
    // On expose un extrait tronqué de l'account_id (jamais le compte complet côté client)
    accountIdPreview: restaurant.stripeAccountId
      ? `${restaurant.stripeAccountId.slice(0, 8)}…`
      : null,
  });
}

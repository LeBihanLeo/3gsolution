// TICK-163 — Stripe Connect : déconnexion du compte restaurant
// TICK-175 — Accounts v2 : stripe.accounts.del remplace stripe.oauth.deauthorize
// TICK-181 — Soft disconnect : nettoyage DB uniquement (stripe.accounts.del retiré)
//            Le compte Express Stripe reste intact → l'admin peut se re-connecter sans perte d'historique.
//            La suppression définitive (RGPD) sera un endpoint dédié dans un sprint futur.
// DELETE /api/stripe/connect/disconnect
// Réservé à l'admin du restaurant (son propre compte, via session.user.restaurantId).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { logger } from '@/lib/logger';

export async function DELETE(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; restaurantId?: string } | undefined;

  if (!user || user.role !== 'admin' || !user.restaurantId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const restaurantId = user.restaurantId;

  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId)
    .select('stripeAccountId stripeOnboardingComplete')
    .lean();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
  }

  if (!restaurant.stripeOnboardingComplete || !restaurant.stripeAccountId) {
    return NextResponse.json({ error: 'Aucun compte Stripe connecté' }, { status: 400 });
  }

  // TICK-181 — Déconnexion logique uniquement (soft disconnect)
  // Le compte Express Stripe reste intact côté Stripe — l'admin peut se re-connecter
  // via POST /initiate sans perdre son historique de paiements.
  // stripe.accounts.del (suppression définitive) est réservé à la fermeture RGPD (sprint futur).
  await Restaurant.findByIdAndUpdate(restaurantId, {
    $unset: { stripeAccountId: 1 },
    stripeOnboardingComplete: false,
  });

  logger.info('stripe_connect_disconnected', { restaurantId });
  return NextResponse.json({ message: 'Compte Stripe déconnecté' });
}

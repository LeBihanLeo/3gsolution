// TICK-157 — Stripe Connect : client platform unique (remplace getStripeClient factory TICK-139)
// Architecture : Direct charges via { stripeAccount: acct_xxx } — aucune clé par restaurant en DB.
// Un seul STRIPE_SECRET_KEY (plateforme) + STRIPE_CONNECT_WEBHOOK_SECRET (webhook Connect global).
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

if (!process.env.STRIPE_SECRET_KEY) {
  // Non bloquant au build — bloquant à l'exécution dans checkout/webhook
  console.warn('[stripe] STRIPE_SECRET_KEY manquant — les paiements réels échoueront');
}

/**
 * Client Stripe de la plateforme.
 * Utilisé avec { stripeAccount: acct_xxx } pour les direct charges sur les comptes connectés.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
});

/**
 * Retourne le stripeAccountId (acct_xxx) du restaurant connecté via OAuth.
 * Retourne null si le restaurant n'a pas finalisé son onboarding Connect.
 */
export async function getStripeAccountId(restaurantId: string): Promise<string | null> {
  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId)
    .select('stripeAccountId stripeOnboardingComplete')
    .lean();

  if (!restaurant?.stripeOnboardingComplete || !restaurant.stripeAccountId) {
    return null;
  }
  return restaurant.stripeAccountId;
}

/**
 * Vérifie la signature d'un événement webhook Connect Stripe.
 * Utilise STRIPE_CONNECT_WEBHOOK_SECRET — un seul secret pour tous les comptes connectés.
 * Lève une erreur si la signature est invalide.
 */
export function constructConnectEvent(body: string, sig: string): Stripe.Event {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_CONNECT_WEBHOOK_SECRET manquant');
  }
  return stripe.webhooks.constructEvent(body, sig, secret);
}

// TICK-139 — Stripe multi-tenant : factory par tenant avec cache Map
// Remplace le singleton getStripe() — la clé Stripe est chargée depuis le
// document Restaurant (champ select:false, jamais exposé en API).
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

const stripeClients = new Map<string, Stripe>();

export async function getStripeClient(restaurantId: string): Promise<Stripe> {
  if (stripeClients.has(restaurantId)) return stripeClients.get(restaurantId)!;
  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId).select('+stripeSecretKey');
  if (!restaurant?.stripeSecretKey) {
    throw new Error('Stripe non configuré pour ce restaurant');
  }
  const client = new Stripe(restaurant.stripeSecretKey, {
    apiVersion: '2026-02-25.clover',
  });
  stripeClients.set(restaurantId, client);
  return client;
}

/**
 * Invalide le cache du client Stripe pour un restaurant.
 * À appeler après mise à jour des clés Stripe via PUT /api/superadmin/restaurants/[id].
 */
export function invalidateStripeClient(restaurantId: string): void {
  stripeClients.delete(restaurantId);
}

/**
 * Instancie un client Stripe depuis une clé secrète directe.
 * Utilisé en fallback pour les événements sans metadata.restaurantId
 * (ex: charge.refunded, disputes) pendant la migration mono→multi-tenant.
 * Exporté séparément pour permettre le mock dans les tests.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
}

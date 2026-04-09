// TICK-139 — Stripe multi-tenant : getStripeClient(restaurantId) factory
// Chaque restaurant a ses propres clés Stripe stockées en DB (select: false).
// Un cache Map évite un lookup DB par requête checkout.
import Stripe from 'stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

// Cache module-level (singleton par instance Node.js)
const stripeClientCache = new Map<string, Stripe>();

/**
 * Retourne un client Stripe initialisé avec la clé du restaurant.
 * - restaurantId = null → fallback sur STRIPE_SECRET_KEY env var (dev/mock)
 * - Lève une erreur si aucune clé n'est disponible
 */
export async function getStripeClient(restaurantId: string | null): Promise<Stripe> {
  // Fallback global (dev / variable d'env)
  if (!restaurantId) {
    return getStripeFromEnv();
  }

  if (stripeClientCache.has(restaurantId)) {
    return stripeClientCache.get(restaurantId)!;
  }

  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId)
    .select('+stripeSecretKey')
    .lean();

  if (!restaurant?.stripeSecretKey) {
    // Pas de clé en DB → fallback env var (dev)
    return getStripeFromEnv();
  }

  const client = new Stripe(restaurant.stripeSecretKey, {
    apiVersion: '2026-02-25.clover',
  });
  stripeClientCache.set(restaurantId, client);
  return client;
}

/**
 * Retourne le webhookSecret du restaurant pour vérifier la signature Stripe.
 * Fallback sur STRIPE_WEBHOOK_SECRET env var si rien en DB.
 */
export async function getStripeWebhookSecret(restaurantId: string): Promise<string | null> {
  await connectDB();
  const restaurant = await Restaurant.findById(restaurantId)
    .select('+stripeWebhookSecret')
    .lean();

  return restaurant?.stripeWebhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// ── Fallback env var (dev / rétrocompatibilité) ───────────────────────────────
function getStripeFromEnv(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe non configuré : STRIPE_SECRET_KEY manquant et aucune clé en DB pour ce restaurant');
  }
  const cacheKey = '__env__';
  if (stripeClientCache.has(cacheKey)) return stripeClientCache.get(cacheKey)!;
  const client = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });
  stripeClientCache.set(cacheKey, client);
  return client;
}

// Rétrocompatibilité — à supprimer après migration complète
/** @deprecated Utiliser getStripeClient(restaurantId) à la place */
export function getStripe(): Stripe {
  return getStripeFromEnv();
}

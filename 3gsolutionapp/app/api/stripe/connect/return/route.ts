// TICK-175 — Stripe Connect Accounts v2 : retour d'onboarding
// TICK-179 — CSRF cross-domain : state token HMAC (remplace getServerSession sur le hub)
// TICK-180 — Vérification charges_enabled avant stripeOnboardingComplete: true
// GET /api/stripe/connect/return?restaurantId=xxx&state=HMAC&expires=TS
// Remplace GET /api/stripe/connect/callback (OAuth v1 — déprécié)
//
// Appelé par Stripe après que le restaurant a complété (ou abandonné) l'onboarding hébergé.
// Protection CSRF : state token HMAC signé pendant initiate (cross-domain safe, pas de session).
// Vérifie details_submitted ET charges_enabled avant de valider l'onboarding.
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { logger } from '@/lib/logger';

/**
 * URL de base pour les redirections d'erreur avant résolution du restaurant.
 * Utilise AUTH_HUB_URL (hub centralisé) ou localhost en dev.
 */
function getFallbackErrorUrl(): string {
  const hubUrl = process.env.AUTH_HUB_URL;
  if (hubUrl) return `${hubUrl}/espace-restaurateur/stripe`;
  return 'http://localhost:3000/espace-restaurateur/stripe';
}

// TICK-179 — Vérifie le state token HMAC généré lors de initiate.
// timingSafeEqual protège contre les timing attacks.
function verifyStateToken(restaurantId: string, state: string, expires: string): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || Math.floor(Date.now() / 1000) > expiresNum) return false;

  const payload = `${restaurantId}:${expiresNum}`;
  const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(state, 'hex'));
  } catch {
    // Longueur invalide → faux
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get('restaurantId');
  const fallbackErrorUrl = getFallbackErrorUrl();

  if (!restaurantId) {
    return NextResponse.redirect(`${fallbackErrorUrl}?error=missing_restaurant`, 302);
  }

  // TICK-179 — CSRF : vérification HMAC (cross-domain safe, pas besoin de session sur le hub)
  const state   = searchParams.get('state') ?? '';
  const expires = searchParams.get('expires') ?? '';

  if (!verifyStateToken(restaurantId, state, expires)) {
    logger.error('stripe_connect_return_unauthorized', { restaurantId });
    return NextResponse.redirect(`${fallbackErrorUrl}?error=unauthorized`, 302);
  }

  try {
    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId)
      .select('stripeAccountId domaine')
      .lean();

    if (!restaurant?.stripeAccountId) {
      logger.error('stripe_connect_return_no_account', { restaurantId });
      return NextResponse.redirect(`${fallbackErrorUrl}?error=connect_failed`, 302);
    }

    // TICK-180 — Vérifie l'état de l'onboarding directement via l'API Stripe
    // details_submitted = infos soumises, charges_enabled = compte opérationnel (KYC validé)
    const account = await stripe.accounts.retrieve(restaurant.stripeAccountId);

    if (!account.details_submitted || !account.charges_enabled) {
      logger.error('stripe_connect_onboarding_not_ready', {
        restaurantId,
        stripeAccountId: restaurant.stripeAccountId,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
      });
      return NextResponse.redirect(
        `https://${restaurant.domaine}/espace-restaurateur/stripe?error=onboarding_incomplete`,
        302
      );
    }

    // Onboarding terminé et compte opérationnel — marque le compte comme actif
    await Restaurant.findByIdAndUpdate(restaurantId, { stripeOnboardingComplete: true });

    logger.info('stripe_connect_onboarding_complete', {
      restaurantId,
      stripeAccountId: restaurant.stripeAccountId,
    });

    // TICK-196 — Si returnTo=onboarding, redirige vers le wizard onboarding (step Stripe)
    const returnTo = searchParams.get('returnTo');
    if (returnTo === 'onboarding') {
      return NextResponse.redirect(
        `https://${restaurant.domaine}/espace-restaurateur/onboarding?step=3&connected=true`,
        302
      );
    }

    return NextResponse.redirect(
      `https://${restaurant.domaine}/espace-restaurateur/stripe?connected=true`,
      302
    );
  } catch (err) {
    logger.error('stripe_connect_return_failed', { restaurantId }, err);
    return NextResponse.redirect(`${fallbackErrorUrl}?error=connect_failed`, 302);
  }
}

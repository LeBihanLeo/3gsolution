// TICK-175 — Stripe Connect Accounts v2 : rafraîchissement du lien d'onboarding
// TICK-179 — CSRF cross-domain : state token HMAC (remplace getServerSession sur le hub)
// GET /api/stripe/connect/refresh?restaurantId=xxx&state=HMAC&expires=TS
//
// Appelé par Stripe quand le lien accountLink précédent a expiré (durée de vie : 5 min).
// Régénère un nouveau lien sans recréer le compte Stripe (stripeAccountId reste identique).
// Protection CSRF : state token HMAC signé pendant initiate (cross-domain safe, pas de session).
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { logger } from '@/lib/logger';

function getFallbackErrorUrl(): string {
  const hubUrl = process.env.AUTH_HUB_URL;
  if (hubUrl) return `${hubUrl}/admin/stripe`;
  return 'http://localhost:3000/admin/stripe';
}

// TICK-179 — Même logique de vérification que dans return/route.ts
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
    logger.error('stripe_connect_refresh_unauthorized', { restaurantId });
    return NextResponse.redirect(`${fallbackErrorUrl}?error=unauthorized`, 302);
  }

  // AUTH_HUB_URL centralise tous les callbacks — même pattern que initiate
  const hubUrl = process.env.AUTH_HUB_URL;
  if (!hubUrl) {
    logger.error('stripe_connect_missing_hub_url', { restaurantId });
    return NextResponse.redirect(`${fallbackErrorUrl}?error=config_error`, 302);
  }
  const returnUrl  = `${hubUrl}/api/stripe/connect/return`;
  const refreshUrl = `${hubUrl}/api/stripe/connect/refresh`;

  try {
    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId)
      .select('stripeAccountId')
      .lean();

    if (!restaurant?.stripeAccountId) {
      logger.error('stripe_connect_refresh_no_account', { restaurantId });
      return NextResponse.redirect(`${fallbackErrorUrl}?error=connect_failed`, 302);
    }

    // Régénère un nouveau lien — le compte Stripe existant est réutilisé
    // Le state/expires restent les mêmes (toujours dans la fenêtre de 10 min)
    const accountLink = await stripe.accountLinks.create({
      account: restaurant.stripeAccountId,
      return_url:  `${returnUrl}?restaurantId=${restaurantId}&state=${state}&expires=${expires}`,
      refresh_url: `${refreshUrl}?restaurantId=${restaurantId}&state=${state}&expires=${expires}`,
      type: 'account_onboarding',
    });

    logger.info('stripe_account_link_refreshed', { restaurantId });
    return NextResponse.redirect(accountLink.url, 302);
  } catch (err) {
    logger.error('stripe_connect_refresh_failed', { restaurantId }, err);
    return NextResponse.redirect(`${fallbackErrorUrl}?error=connect_failed`, 302);
  }
}

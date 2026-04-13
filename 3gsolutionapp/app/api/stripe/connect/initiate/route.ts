// TICK-175 — Stripe Connect Accounts v2 : initiation onboarding
// TICK-179 — CSRF cross-domain : state token HMAC (remplace getServerSession sur le hub)
// POST /api/stripe/connect/initiate
// Remplace GET /api/stripe/connect (OAuth v1 — déprécié par Stripe)
//
// Architecture :
//   1. Crée un compte Stripe Express pour le restaurant (si absent)
//   2. Génère un state HMAC signé (NEXTAUTH_SECRET) inclus dans return_url/refresh_url
//   3. Génère un accountLink d'onboarding hébergé (expire après 5 min)
//   4. Redirige 302 → page hébergée Stripe
//   Le stripeAccountId est sauvegardé en DB avant l'onboarding,
//   stripeOnboardingComplete passe à true via le webhook account.updated (TICK-178)
//   ou via la route /return (TICK-175).
//   Le state token permet au hub de vérifier l'identité sans session cross-domain.
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { logger } from '@/lib/logger';

// TICK-179 — Génère un state token signé HMAC valide 10 minutes.
// Inclus dans return_url et refresh_url → vérifié par le hub sans session cross-domain.
function generateStateToken(restaurantId: string): { state: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + 10 * 60; // +10 min
  const payload = `${restaurantId}:${expires}`;
  const state = createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '')
    .update(payload)
    .digest('hex');
  return { state, expires };
}

export async function POST(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; restaurantId?: string } | undefined;

  if (!user || user.role !== 'admin' || !user.restaurantId) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const restaurantId = user.restaurantId;

  const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL;
  const refreshUrl = process.env.STRIPE_CONNECT_REFRESH_URL;

  if (!returnUrl || !refreshUrl) {
    logger.error('stripe_connect_missing_urls', { restaurantId });
    return NextResponse.json({ error: 'Configuration serveur incorrecte' }, { status: 500 });
  }

  try {
    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId)
      .select('stripeAccountId stripeOnboardingComplete')
      .lean();

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
    }

    let stripeAccountId = restaurant.stripeAccountId;

    // Crée un nouveau compte Express si pas encore associé au restaurant
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',   // TICK-182 — Pré-remplit le pays → supprime un écran d'onboarding
        metadata: { restaurantId },
      });
      stripeAccountId = account.id;
      await Restaurant.findByIdAndUpdate(restaurantId, { stripeAccountId });
      logger.info('stripe_account_created', { restaurantId, stripeAccountId });
    }

    // TICK-179 — State token HMAC inclus dans return_url et refresh_url
    // Le hub vérifie la signature sans session (cross-domain safe)
    const { state, expires } = generateStateToken(restaurantId);

    // Génère le lien d'onboarding hébergé (valide 5 minutes)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      return_url:  `${returnUrl}?restaurantId=${restaurantId}&state=${state}&expires=${expires}`,
      refresh_url: `${refreshUrl}?restaurantId=${restaurantId}&state=${state}&expires=${expires}`,
      type: 'account_onboarding',
    });

    logger.info('stripe_account_link_created', { restaurantId, stripeAccountId });
    return NextResponse.redirect(accountLink.url, 302);
  } catch (err) {
    logger.error('stripe_connect_initiate_failed', { restaurantId }, err);
    return NextResponse.json(
      { error: "Erreur lors de l'initialisation Stripe Connect" },
      { status: 500 }
    );
  }
}

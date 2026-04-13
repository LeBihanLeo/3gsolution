// TICK-160 — Webhook Stripe Connect global (remplace TICK-134 multi-tenant par clé)
// Un seul STRIPE_CONNECT_WEBHOOK_SECRET pour tous les comptes connectés.
// Le tenant est résolu via event.account (acct_xxx) → Restaurant.stripeAccountId.
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, constructConnectEvent } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import PendingOrder from '@/models/PendingOrder';
import Restaurant from '@/models/Restaurant';
import WebhookFailedEvent from '@/models/WebhookFailedEvent';
import { sendConfirmationEmail, sendDisputeAlert, sendChargeFailedAlert } from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = constructConnectEvent(body, sig);
  } catch (err) {
    logger.error('webhook_invalid_signature', { route: '/api/webhooks/stripe' }, err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Résolution du tenant via event.account (acct_xxx → Restaurant)
  // Les events Connect ont toujours event.account ; les events platform n'en ont pas.
  let restaurantId: string | null = null;
  if (event.account) {
    try {
      await connectDB();
      const restaurant = await Restaurant.findOne({ stripeAccountId: event.account })
        .select('_id')
        .lean();
      restaurantId = restaurant?._id?.toString() ?? null;

      if (!restaurantId) {
        logger.error('webhook_unknown_stripe_account', {
          stripeAccount: event.account,
          eventType: event.type,
          eventId: event.id,
        });
        // On répond 200 pour éviter les retries Stripe sur un compte non reconnu
        return NextResponse.json({ received: true });
      }
    } catch (err) {
      logger.error('webhook_tenant_resolution_failed', { eventId: event.id }, err);
      return NextResponse.json({ received: true });
    }
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        await handleSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          event.account ?? null
        );
        break;
      }

      case 'checkout.session.expired': {
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge, restaurantId);
        break;
      }

      case 'charge.failed': {
        await handleChargeFailed(event.data.object as Stripe.Charge, restaurantId);
        break;
      }

      case 'charge.dispute.created': {
        await handleDisputeCreated(event.data.object as Stripe.Dispute, restaurantId);
        break;
      }

      case 'charge.dispute.closed': {
        await handleDisputeClosed(event.data.object as Stripe.Dispute, restaurantId);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        logger.error('payment_failed', {
          paymentIntentId: pi.id,
          error: pi.last_payment_error?.message ?? 'unknown',
          code: pi.last_payment_error?.code ?? 'unknown',
        });
        break;
      }

      // TICK-178 — Accounts v2 : sync onboarding via webhook (filet si /return non atteint)
      case 'account.updated': {
        await handleAccountUpdated(event.data.object as Stripe.Account, restaurantId);
        break;
      }

      // TICK-178 — Accounts v2 : le restaurant a révoqué l'accès depuis son dashboard Stripe
      case 'account.application.deauthorized': {
        await handleApplicationDeauthorized(restaurantId, event.account ?? null);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error('webhook_handler_failed', { eventType: event.type, eventId: event.id }, err);

    try {
      await connectDB();
      await WebhookFailedEvent.findOneAndUpdate(
        { stripeEventId: event.id },
        {
          $setOnInsert: {
            stripeEventId: event.id,
            eventType: event.type,
            payload: body,
            error: err instanceof Error ? err.message : String(err),
          },
        },
        { upsert: true }
      );
    } catch (dlqErr) {
      logger.error('webhook_dlq_write_failed', { eventId: event.id }, dlqErr);
    }
  }

  return NextResponse.json({ received: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleSessionCompleted(
  session: Stripe.Checkout.Session,
  stripeAccount: string | null
) {
  const metadata = session.metadata ?? {};

  await connectDB();

  const pendingOrderId = metadata.pending_order_id;
  if (!pendingOrderId) {
    logger.error('webhook_missing_pending_order_id', { stripeSessionId: session.id });
    return;
  }

  const pendingOrder = await PendingOrder.findById(pendingOrderId);
  if (!pendingOrder) {
    logger.error('webhook_pending_order_not_found', { stripeSessionId: session.id, pendingOrderId });
    return;
  }

  const { client, retrait, commentaire, produits, clientId, restaurantId } = pendingOrder;

  const total = produits.reduce(
    (sum: number, p: { prix: number; options: { prix: number }[]; quantite: number }) =>
      sum + (p.prix + p.options.reduce((s: number, o: { prix: number }) => s + o.prix, 0)) * p.quantite,
    0
  );

  const purgeAt = new Date();
  purgeAt.setFullYear(purgeAt.getFullYear() + 1);

  // Récupère le receiptUrl via le compte Connect du restaurant (direct charge)
  let receiptUrl: string | undefined;
  try {
    if (session.payment_intent) {
      const piOptions = stripeAccount ? { stripeAccount } : {};
      const pi = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] },
        piOptions
      );
      receiptUrl = (pi.latest_charge as Stripe.Charge)?.receipt_url ?? undefined;
    }
  } catch {
    // non-bloquant
  }

  // TICK-172 — Insertion atomique via upsert + $setOnInsert (idempotence sous requêtes concurrentes)
  // L'index unique sur stripeSessionId est le dernier filet de sécurité côté DB.
  // result === null → insertion réussie ; result !== null → commande déjà existante (doublon webhook)
  const commandeData = {
    stripeSessionId: session.id,
    ...(session.payment_intent ? { stripePaymentIntentId: session.payment_intent as string } : {}),
    statut: 'payee' as const,
    client,
    retrait,
    produits,
    ...(commentaire ? { commentaire } : {}),
    total,
    purgeAt,
    ...(clientId ? { clientId } : {}),
    ...(receiptUrl ? { receiptUrl } : {}),
    restaurantId,
  };

  const existingDoc = await Commande.findOneAndUpdate(
    { stripeSessionId: session.id },
    { $setOnInsert: commandeData },
    { upsert: true, new: false }
  );

  if (existingDoc !== null) {
    // Doublon webhook — commande déjà créée lors d'un précédent appel
    logger.info('webhook_session_completed_idempotent', { stripeSessionId: session.id });
    return;
  }

  // Insertion réussie — récupère le document créé pour l'email
  const commande = await Commande.findOne({ stripeSessionId: session.id });
  if (!commande) return; // ne devrait pas arriver

  await PendingOrder.findByIdAndDelete(pendingOrderId);

  if (client.email) {
    try {
      await sendConfirmationEmail(commande, receiptUrl);
    } catch (emailErr) {
      logger.error('webhook_email_failed', { stripeSessionId: session.id }, emailErr);
    }
  }
}

async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const pendingOrderId = session.metadata?.pending_order_id;
  if (!pendingOrderId) return;

  await connectDB();
  await PendingOrder.findByIdAndDelete(pendingOrderId);

  logger.info('checkout_session_expired_cleaned', {
    stripeSessionId: session.id,
    pendingOrderId,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge, restaurantId: string | null) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_refund_no_payment_intent', { chargeId: charge.id });
    return;
  }

  await connectDB();

  const filter: Record<string, unknown> = { stripePaymentIntentId: paymentIntentId };
  if (restaurantId) filter.restaurantId = restaurantId;
  const commande = await Commande.findOne(filter);
  if (!commande) {
    logger.error('webhook_refund_commande_not_found', { paymentIntentId, chargeId: charge.id });
    return;
  }

  if (!charge.refunded) {
    if (commande.statut === 'remboursee') return;
    commande.statut = 'partiellement_remboursee';
    commande.montantRembourse = charge.amount_refunded;
    await commande.save();
    logger.info('partial_refund_received', {
      commandeId: commande._id.toString(),
      paymentIntentId,
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      amountTotal: charge.amount,
    });
    return;
  }

  if (commande.statut === 'remboursee') return;

  commande.statut = 'remboursee';
  commande.rembourseAt = new Date();
  commande.montantRembourse = charge.amount_refunded;
  await commande.save();

  logger.info('commande_remboursee', {
    commandeId: commande._id.toString(),
    paymentIntentId,
    chargeId: charge.id,
    amountRefunded: charge.amount_refunded,
  });
}

async function handleChargeFailed(charge: Stripe.Charge, restaurantId: string | null) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_charge_failed_no_payment_intent', { chargeId: charge.id });
    return;
  }

  await connectDB();

  const filter: Record<string, unknown> = { stripePaymentIntentId: paymentIntentId };
  if (restaurantId) filter.restaurantId = restaurantId;
  const commande = await Commande.findOne(filter);
  if (!commande) {
    logger.info('charge_failed_no_commande', {
      paymentIntentId,
      chargeId: charge.id,
      failureCode: charge.failure_code ?? 'unknown',
    });
    return;
  }

  if (commande.statut === 'charge_echouee') return;

  const raison = charge.failure_message ?? charge.failure_code ?? 'Capture échouée';
  commande.statut = 'charge_echouee';
  commande.chargeEchoueeAt = new Date();
  commande.chargeEchoueeRaison = raison;
  await commande.save();

  logger.error('charge_failed_commande_existante', {
    commandeId: commande._id.toString(),
    paymentIntentId,
    chargeId: charge.id,
    failureCode: charge.failure_code,
    failureMessage: charge.failure_message,
  });

  try {
    await sendChargeFailedAlert({
      commandeId: commande._id.toString(),
      paymentIntentId,
      chargeId: charge.id,
      raison,
    });
  } catch (alertErr) {
    logger.error('webhook_charge_failed_alert_email_failed', { commandeId: commande._id.toString() }, alertErr);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute, restaurantId: string | null) {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_dispute_no_payment_intent', { disputeId: dispute.id });
    return;
  }

  await connectDB();

  const filter: Record<string, unknown> = { stripePaymentIntentId: paymentIntentId };
  if (restaurantId) filter.restaurantId = restaurantId;
  const commande = await Commande.findOne(filter);
  if (!commande) {
    logger.error('webhook_dispute_commande_not_found', { paymentIntentId, disputeId: dispute.id });
    return;
  }

  if (commande.statut === 'dispute') return;

  commande.statut = 'dispute';
  commande.stripeDisputeId = dispute.id;
  commande.disputeAt = new Date();
  await commande.save();

  logger.error('commande_en_dispute', {
    commandeId: commande._id.toString(),
    paymentIntentId,
    disputeId: dispute.id,
    reason: dispute.reason,
    amount: dispute.amount,
  });

  try {
    await sendDisputeAlert({
      commandeId: commande._id.toString(),
      disputeId: dispute.id,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    });
  } catch (alertErr) {
    logger.error('webhook_dispute_alert_email_failed', { disputeId: dispute.id }, alertErr);
  }
}

// TICK-178 — Accounts v2 : sync onboarding si le restaurant ferme la fenêtre avant /return
// TICK-180 — Vérifie charges_enabled en plus de details_submitted (KYC peut être en cours)
async function handleAccountUpdated(account: Stripe.Account, restaurantId: string | null) {
  if (!restaurantId) return;
  // details_submitted = infos soumises, charges_enabled = KYC validé par Stripe
  // Un second account.updated arrivera quand charges_enabled passera à true
  if (!account.details_submitted || !account.charges_enabled) return;

  await connectDB();
  await Restaurant.findByIdAndUpdate(restaurantId, { stripeOnboardingComplete: true });

  logger.info('stripe_account_onboarding_complete_via_webhook', {
    restaurantId,
    stripeAccountId: account.id,
  });
}

// TICK-178 — Accounts v2 : le restaurant a révoqué l'accès depuis son dashboard Stripe
// Nettoyage DB pour éviter des paiements qui échoueraient silencieusement
async function handleApplicationDeauthorized(
  restaurantId: string | null,
  stripeAccountId: string | null
) {
  if (!restaurantId || !stripeAccountId) return;

  await connectDB();
  await Restaurant.findByIdAndUpdate(restaurantId, {
    $unset: { stripeAccountId: 1 },
    stripeOnboardingComplete: false,
  });

  logger.error('stripe_application_deauthorized', { restaurantId, stripeAccountId });
  // TODO Sprint 23 : notifier l'admin par email que sa connexion Stripe a été révoquée
}

async function handleDisputeClosed(dispute: Stripe.Dispute, restaurantId: string | null) {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) return;

  await connectDB();

  const filter: Record<string, unknown> = { stripePaymentIntentId: paymentIntentId };
  if (restaurantId) filter.restaurantId = restaurantId;
  const commande = await Commande.findOne(filter);
  if (!commande) {
    logger.error('webhook_dispute_closed_commande_not_found', { paymentIntentId, disputeId: dispute.id });
    return;
  }

  if (dispute.status === 'won') {
    commande.statut = 'payee';
    await commande.save();
    logger.info('dispute_won', { commandeId: commande._id.toString(), disputeId: dispute.id });
  } else if (dispute.status === 'lost') {
    commande.statut = 'remboursee';
    commande.rembourseAt = new Date();
    commande.montantRembourse = dispute.amount;
    await commande.save();
    logger.error('dispute_lost', {
      commandeId: commande._id.toString(),
      disputeId: dispute.id,
      amount: dispute.amount,
    });
  } else {
    logger.info('dispute_warning_closed', { commandeId: commande._id.toString(), disputeId: dispute.id });
  }
}

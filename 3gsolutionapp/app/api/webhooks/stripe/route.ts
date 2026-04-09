// TICK-134 — Webhook Stripe tenant-aware :
//   le restaurantId est résolu depuis PendingOrder (stocké au checkout).
//   getStripeClient(restaurantId) charge la clé Stripe + webhookSecret du restaurant.
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import PendingOrder from '@/models/PendingOrder';
import WebhookFailedEvent from '@/models/WebhookFailedEvent';
import { sendConfirmationEmail, sendDisputeAlert, sendChargeFailedAlert } from '@/lib/email';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  // Lire le corps brut AVANT toute autre opération (requis par Stripe)
  const body = await request.text();

  // ── Résolution du tenant depuis le pending_order_id dans le payload ────────
  // On parse le payload JSON manuellement pour extraire pending_order_id AVANT
  // la vérification de signature (on ne fait pas confiance au payload non vérifié,
  // mais on a besoin du restaurantId pour charger le bon webhookSecret).
  // Mitigation : si pending_order_id est forgé, l'étape de vérification signature
  // suivante échouera de toutes façons (wrong secret → 400).
  let restaurantId: string | null = null;
  let webhookSecret: string | null = null;

  try {
    const rawPayload = JSON.parse(body);
    const pendingOrderId = rawPayload?.data?.object?.metadata?.pending_order_id;

    if (pendingOrderId) {
      await connectDB();
      const pendingOrder = await PendingOrder.findById(pendingOrderId).select('restaurantId').lean();
      if (pendingOrder?.restaurantId) {
        restaurantId = pendingOrder.restaurantId;
        webhookSecret = await getStripeWebhookSecret(restaurantId);
      }
    }
  } catch {
    // Non-bloquant — fallback sur la clé globale si disponible
  }

  // Fallback sur la variable d'env globale (compatibilité / dev)
  if (!webhookSecret) {
    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
  }

  if (!webhookSecret) {
    logger.error('webhook_config_missing', { route: '/api/webhooks/stripe' });
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 });
  }

  // Charger le client Stripe correspondant au restaurant (ou global)
  const stripe = restaurantId
    ? await getStripeClient(restaurantId)
    : await getStripeClient(null);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    logger.error('webhook_invalid_signature', { route: '/api/webhooks/stripe' }, err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        await handleSessionCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      }

      case 'checkout.session.expired': {
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }

      case 'charge.failed': {
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;
      }

      case 'charge.dispute.created': {
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      }

      case 'charge.dispute.closed': {
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
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

async function handleSessionCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
  const metadata = session.metadata ?? {};

  await connectDB();

  const existing = await Commande.findOne({ stripeSessionId: session.id });
  if (existing) return;

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

  let receiptUrl: string | undefined;
  try {
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] }
      );
      receiptUrl = (pi.latest_charge as Stripe.Charge)?.receipt_url ?? undefined;
    }
  } catch {
    // non-bloquant
  }

  const commande = await Commande.create({
    stripeSessionId: session.id,
    ...(session.payment_intent ? { stripePaymentIntentId: session.payment_intent as string } : {}),
    statut: 'payee',
    client,
    retrait,
    produits,
    ...(commentaire ? { commentaire } : {}),
    total,
    purgeAt,
    ...(clientId ? { clientId } : {}),
    ...(receiptUrl ? { receiptUrl } : {}),
    restaurantId, // TICK-134
  });

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

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_refund_no_payment_intent', { chargeId: charge.id });
    return;
  }

  await connectDB();

  const commande = await Commande.findOne({ stripePaymentIntentId: paymentIntentId });
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

async function handleChargeFailed(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_charge_failed_no_payment_intent', { chargeId: charge.id });
    return;
  }

  await connectDB();

  const commande = await Commande.findOne({ stripePaymentIntentId: paymentIntentId });
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

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.error('webhook_dispute_no_payment_intent', { disputeId: dispute.id });
    return;
  }

  await connectDB();

  const commande = await Commande.findOne({ stripePaymentIntentId: paymentIntentId });
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

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const paymentIntentId = dispute.payment_intent as string | null;
  if (!paymentIntentId) return;

  await connectDB();

  const commande = await Commande.findOne({ stripePaymentIntentId: paymentIntentId });
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

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import PendingOrder from '@/models/PendingOrder';
import { sendConfirmationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

// Désactiver le body parsing automatique pour lire le corps brut
// (requis pour la vérification de signature Stripe)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('webhook_config_missing', { route: '/api/webhooks/stripe' });
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 });
  }

  // Lire le corps brut AVANT toute autre opération (requis par Stripe)
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('webhook_invalid_signature', { route: '/api/webhooks/stripe' }, err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Paiement complété ────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        await handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      // ── Session expirée (abandon ou expiration 30 min) ───────────────────────
      // Nettoyage immédiat du PendingOrder (sinon TTL de 1h le fait)
      case 'checkout.session.expired': {
        await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      // ── Remboursement émis depuis le Dashboard Stripe ────────────────────────
      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }

      // ── Dispute ouverte (contestation client auprès de sa banque) ────────────
      case 'charge.dispute.created': {
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      }

      // ── Dispute clôturée (gagnée, perdue, ou avertissement fermé) ────────────
      case 'charge.dispute.closed': {
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;
      }

      // ── Paiement échoué (carte refusée, fonds insuffisants…) ─────────────────
      // Pas d'action en base — log pour visibilité opérationnelle
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
        // Événements non gérés : 200 silencieux (évite les retries inutiles)
        break;
    }
  } catch (err) {
    // Log sans crash : Stripe retentera si on renvoie une erreur 5xx
    logger.error('webhook_handler_failed', { eventType: event.type }, err);
  }

  // Répondre rapidement (Stripe timeout = 30s)
  return NextResponse.json({ received: true });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};

  await connectDB();

  // Idempotence : ne pas créer deux fois la même commande
  const existing = await Commande.findOne({ stripeSessionId: session.id });
  if (existing) return;

  // Charger le snapshot depuis MongoDB (évite la limite 500 chars/valeur metadata Stripe)
  const pendingOrderId = metadata.pending_order_id;
  if (!pendingOrderId) {
    logger.error('webhook_missing_pending_order_id', { stripeSessionId: session.id });
    return;
  }

  const pendingOrder = await PendingOrder.findById(pendingOrderId);
  if (!pendingOrder) {
    // TTL expiré ou document inexistant (paiement > 1h après création — cas très rare)
    logger.error('webhook_pending_order_not_found', {
      stripeSessionId: session.id,
      pendingOrderId,
    });
    return;
  }

  const { client, retrait, commentaire, produits, clientId } = pendingOrder;

  const total = produits.reduce(
    (sum: number, p: { prix: number; options: { prix: number }[]; quantite: number }) =>
      sum + (p.prix + p.options.reduce((s: number, o: { prix: number }) => s + o.prix, 0)) * p.quantite,
    0
  );

  // TICK-057 — RGPD Art. 5(1)(e) : durée de rétention 12 mois (obligation comptable)
  const purgeAt = new Date();
  purgeAt.setFullYear(purgeAt.getFullYear() + 1);

  const commande = await Commande.create({
    stripeSessionId: session.id,
    // Stocker le PaymentIntent ID pour pouvoir retrouver la commande lors d'un remboursement
    ...(session.payment_intent ? { stripePaymentIntentId: session.payment_intent as string } : {}),
    statut: 'payee',
    client,
    retrait,
    produits,
    ...(commentaire ? { commentaire } : {}),
    total,
    purgeAt,
    ...(clientId ? { clientId } : {}),
  });

  // Supprimer le PendingOrder maintenant que la commande est créée
  await PendingOrder.findByIdAndDelete(pendingOrderId);

  // Récupérer la receipt_url Stripe depuis la charge liée au PaymentIntent
  let receiptUrl: string | undefined;
  try {
    if (session.payment_intent) {
      const pi = await getStripe().paymentIntents.retrieve(
        session.payment_intent as string,
        { expand: ['latest_charge'] }
      );
      receiptUrl = (pi.latest_charge as Stripe.Charge)?.receipt_url ?? undefined;
    }
  } catch {
    // non-bloquant — l'email s'envoie sans lien si l'appel échoue
  }

  // Envoi email de confirmation (erreur silencieuse pour ne pas bloquer)
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
    // Commande introuvable — remboursement d'une transaction hors-app ou TTL purgé
    logger.error('webhook_refund_commande_not_found', { paymentIntentId, chargeId: charge.id });
    return;
  }

  // Remboursement partiel : charge.refunded === false tant que non total
  if (!charge.refunded) {
    // Ne pas rétrograder un statut déjà terminal (idempotence)
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

  // Remboursement total — ne pas écraser un statut déjà terminal (idempotence)
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

  // Idempotence — ne pas écraser si déjà en dispute
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
    // Merchant a gagné — l'argent est resté, on revient à payee
    commande.statut = 'payee';
    await commande.save();
    logger.info('dispute_won', { commandeId: commande._id.toString(), disputeId: dispute.id });
  } else if (dispute.status === 'lost') {
    // Merchant a perdu — l'argent a été retiré (équivalent remboursé)
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
    // warning_closed — avertissement fermé, aucun impact financier
    logger.info('dispute_warning_closed', { commandeId: commande._id.toString(), disputeId: dispute.id });
  }
}

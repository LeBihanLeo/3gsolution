// Réconciliation Stripe — Pull des sessions complétées pour combler les gaps webhook
//
// Cas couverts :
//   1. Webhook checkout.session.completed non reçu (Stripe timeout, serveur down)
//   2. Handler webhook échoué SANS DLQ (rare — DLQ couvre cela normalement)
//   3. Délai de livraison webhook > 30 min
//
// Protection :
//   - Admin JWT (session NextAuth, role=admin)

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import PendingOrder from '@/models/PendingOrder';
import { logger } from '@/lib/logger';

// Fenêtre de réconciliation : 48h
// Couvre les retries Stripe (jusqu'à 3 jours) avec marge de sécurité.
// Limité à 48h pour rester compatible avec le TTL PendingOrder (24h).
const WINDOW_SECONDS = 48 * 60 * 60;

export async function POST(_req: NextRequest) {
  // ── Authentification : admin JWT requis ──────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe non configuré.' }, { status: 503 });
  }

  await connectDB();
  const stripe = getStripe();

  // ── Récupération des sessions Stripe complétées sur les 48 dernières heures ──
  const since = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;

  let sessions: Stripe.Checkout.Session[] = [];
  try {
    // Stripe pagine à 100 max — suffisant pour un restaurant (volume limité)
    const result = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: since },
    });
    sessions = result.data.filter((s) => s.status === 'complete');
  } catch (err) {
    logger.error('reconciliation_stripe_list_failed', {}, err);
    return NextResponse.json({ error: 'Erreur Stripe.' }, { status: 502 });
  }

  let created = 0;
  let skipped = 0;
  let pendingExpired = 0;
  let failed = 0;

  for (const session of sessions) {
    // ── Idempotence : commande déjà existante ──
    const existing = await Commande.findOne({ stripeSessionId: session.id }).lean();
    if (existing) {
      skipped++;
      continue;
    }

    const pendingOrderId = session.metadata?.pending_order_id;
    if (!pendingOrderId) {
      logger.error('reconciliation_no_pending_order_id', { stripeSessionId: session.id });
      failed++;
      continue;
    }

    const pendingOrder = await PendingOrder.findById(pendingOrderId);
    if (!pendingOrder) {
      // PendingOrder expiré (TTL 24h) — impossible de recréer la commande sans les données
      // Le DLQ contient le webhook brut si disponible — vérifier WebhookFailedEvent
      logger.error('reconciliation_pending_order_expired', {
        stripeSessionId: session.id,
        pendingOrderId,
      });
      pendingExpired++;
      continue;
    }

    try {
      const { client, retrait, commentaire, produits, clientId } = pendingOrder;

      const total = produits.reduce(
        (sum: number, p: { prix: number; options: { prix: number }[]; quantite: number }) =>
          sum + (p.prix + p.options.reduce((s: number, o: { prix: number }) => s + o.prix, 0)) * p.quantite,
        0
      );

      const purgeAt = new Date();
      purgeAt.setFullYear(purgeAt.getFullYear() + 1);

      // Tenter de récupérer le receiptUrl
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

      await Commande.create({
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
      });

      await PendingOrder.findByIdAndDelete(pendingOrderId);

      logger.info('reconciliation_commande_created', {
        stripeSessionId: session.id,
        pendingOrderId,
      });

      created++;
    } catch (err) {
      logger.error('reconciliation_create_failed', { stripeSessionId: session.id }, err);
      failed++;
    }
  }

  const result = {
    checkedSessions: sessions.length,
    created,
    skipped,
    pendingExpired,
    failed,
  };

  logger.info('reconciliation_complete', result);

  return NextResponse.json(result);
}

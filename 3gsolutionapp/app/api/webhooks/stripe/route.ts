import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { sendConfirmationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

// TICK-064 — NEW-07 : validation Zod des métadonnées Stripe (OWASP A08:2021)
// Deux risques :
//   1. Limite de 500 chars par valeur dans l'API Stripe → JSON tronqué → parse() lèverait une exception
//   2. Édition manuelle dans le dashboard Stripe → données structurellement incorrectes
// On répond toujours 200 pour éviter les retries Stripe sur données définitivement corrompues.
const ProduitMetadataSchema = z.array(
  z.object({
    produitId: z.string(),
    nom: z.string(),
    prix: z.number().int().min(0),
    quantite: z.number().int().min(1),
    options: z
      .array(
        z.object({
          nom: z.string(),
          prix: z.number().int().min(0),
        })
      )
      .default([]),
  })
);

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

  // Seul l'événement de paiement complété nous intéresse
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};

  try {
    await connectDB();

    // Idempotence : ne pas créer deux fois la même commande
    const existing = await Commande.findOne({ stripeSessionId: session.id });
    if (existing) {
      return NextResponse.json({ received: true });
    }

    // Reconstruire les produits depuis les métadonnées (avec validation Zod — TICK-064)
    let rawProduits: unknown;
    try {
      rawProduits = JSON.parse(metadata.produits ?? '[]');
    } catch {
      logger.error('webhook_invalid_produits_json', { stripeSessionId: session.id });
      // 200 pour ne pas déclencher les retries Stripe sur données définitivement corrompues
      return NextResponse.json({ received: true });
    }

    const parseResult = ProduitMetadataSchema.safeParse(rawProduits);
    if (!parseResult.success) {
      logger.error('webhook_invalid_produits_metadata', { stripeSessionId: session.id });
      return NextResponse.json({ received: true });
    }

    const produits = parseResult.data;

    const total = produits.reduce(
      (sum, p) =>
        sum + (p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite,
      0
    );

    // TICK-057 — RGPD Art. 5(1)(e) : durée de rétention 12 mois (obligation comptable)
    const purgeAt = new Date();
    purgeAt.setFullYear(purgeAt.getFullYear() + 1);

    const commande = await Commande.create({
      stripeSessionId: session.id,
      statut: 'payee',
      client: {
        nom: metadata.client_nom,
        telephone: metadata.client_telephone,
        ...(metadata.client_email ? { email: metadata.client_email } : {}),
      },
      retrait: {
        type: metadata.retrait_type,
        ...(metadata.retrait_creneau ? { creneau: metadata.retrait_creneau } : {}),
      },
      produits,
      ...(metadata.commentaire ? { commentaire: metadata.commentaire } : {}),
      total,
      purgeAt,
    });

    // Envoi email de confirmation (erreur silencieuse pour ne pas bloquer)
    if (metadata.client_email) {
      try {
        await sendConfirmationEmail(commande);
      } catch (emailErr) {
        logger.error('webhook_email_failed', { stripeSessionId: session.id }, emailErr);
      }
    }
  } catch (err) {
    // Log sans crash : Stripe retentera si on renvoie une erreur 5xx
    logger.error('webhook_create_order_failed', { stripeSessionId: session.id }, err);
  }

  // Répondre rapidement (Stripe timeout = 30s)
  return NextResponse.json({ received: true });
}

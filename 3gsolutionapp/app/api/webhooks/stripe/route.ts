import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Commande from '@/models/Commande';
import { sendConfirmationEmail } from '@/lib/email';

// Désactiver le body parsing automatique pour lire le corps brut
// (requis pour la vérification de signature Stripe)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET manquant');
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 });
  }

  // Lire le corps brut AVANT toute autre opération (requis par Stripe)
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook : signature invalide', err);
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

    // Reconstruire les produits depuis les métadonnées
    type ProduitPayload = {
      produitId: string;
      nom: string;
      prix: number;
      quantite: number;
      options: { nom: string; prix: number }[];
    };
    const produits: ProduitPayload[] = JSON.parse(metadata.produits ?? '[]');

    const total = produits.reduce(
      (sum, p) =>
        sum + (p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite,
      0
    );

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
    });

    // Envoi email de confirmation (erreur silencieuse pour ne pas bloquer)
    if (metadata.client_email) {
      try {
        await sendConfirmationEmail(commande);
      } catch (emailErr) {
        console.error('Webhook : erreur envoi email (ignorée)', emailErr);
      }
    }
  } catch (err) {
    // Log sans crash : Stripe retentera si on renvoie une erreur 5xx
    console.error('Webhook : erreur création commande', err);
  }

  // Répondre rapidement (Stripe timeout = 30s)
  return NextResponse.json({ received: true });
}

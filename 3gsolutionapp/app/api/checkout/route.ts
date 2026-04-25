// TICK-050 — SEC-01 : Validation des prix côté serveur (OWASP A04:2021)
// TICK-075 — clientId injecté dans metadata si client connecté
// TICK-134 — restaurantId injecté dans PendingOrder (multi-tenant)
// TICK-135 — SiteConfig remplacé par getTenantRestaurant()
// TICK-157 — stripe client platform + getStripeAccountId (remplace getStripeClient TICK-139)
// TICK-142 — baseUrl dynamique depuis Host header (fix Stripe success_url/cancel_url)
// TICK-159 — Direct charges Connect : { stripeAccount: acct_xxx }
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, getStripeAccountId } from '@/lib/stripe';
import { connectDB } from '@/lib/mongodb';
import Produit from '@/models/Produit';
import PendingOrder from '@/models/PendingOrder';
import { logger } from '@/lib/logger';
import { getTenantId, getTenantRestaurant } from '@/lib/tenant';

// ─── Validation ───────────────────────────────────────────────────────────────

const OptionClientSchema = z.object({
  nom: z.string().min(1),
});

const ProduitCheckoutSchema = z.object({
  produitId: z.string().min(1),
  quantite: z.number().int().min(1).max(99),
  options: z.array(OptionClientSchema).default([]),
});

const CheckoutSchema = z.object({
  client: z.object({
    nom: z.string().min(2, 'Nom requis').max(100),
    telephone: z.string().min(1, 'Téléphone requis').max(30),
    email: z.string().email().optional().or(z.literal('')),
  }),
  retrait: z.object({
    type: z.literal('creneau'),
    creneau: z.string().min(1, 'Un créneau est requis'),
  }),
  commentaire: z.string().max(500).optional(),
  produits: z.array(ProduitCheckoutSchema).min(1, 'Le panier est vide').max(50),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // TICK-135 — Charger la config du restaurant courant (remplace SiteConfig)
    await connectDB();
    const restaurant = await getTenantRestaurant();

    if (restaurant?.fermeeAujourdhui) {
      return NextResponse.json(
        { error: 'La boutique est fermée pour aujourd\'hui.' },
        { status: 503 }
      );
    }

    // CVE-03 — Vérifier les heures d'ouverture en heure locale Paris (pas UTC)
    const ouvertureStr = restaurant?.horaireOuverture ?? '11:30';
    const fermetureStr = restaurant?.horaireFermeture ?? '14:00';
    const now = new Date();
    const parisFormatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parisParts = parisFormatter.formatToParts(now);
    const parisHour = parseInt(parisParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const parisMinute = parseInt(parisParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const nowMin = parisHour * 60 + parisMinute;
    const [hO, mO] = ouvertureStr.split(':').map(Number);
    const [hF, mF] = fermetureStr.split(':').map(Number);
    // Autoriser les commandes jusqu'à 2h avant l'ouverture (les créneaux proposés
    // restent toujours dans la plage ouverture→fermeture, donc jamais de créneau passé).
    const ouvertureMin = hO * 60 + mO;
    const fermetureMin = hF * 60 + mF;
    const PRECOMMANDE_BUFFER_MIN = 120;
    if (nowMin < ouvertureMin - PRECOMMANDE_BUFFER_MIN || nowMin >= fermetureMin) {
      return NextResponse.json(
        { error: `La boutique est fermée. Commandes acceptées de ${ouvertureStr} à ${fermetureStr}.` },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { client, retrait, commentaire, produits: produitsClient } = parsed.data;

    // TICK-142 — baseUrl dynamique depuis Host header (fix Stripe multi-tenant)
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const baseUrl = `${proto}://${host}`;

    // TICK-075 — Récupération clientId si client connecté
    const authSession = await getServerSession(authOptions);
    const clientId =
      authSession?.user?.role === 'client' && authSession.user.id
        ? authSession.user.id
        : undefined;

    // TICK-134 — restaurantId du tenant courant
    const restaurantId = await getTenantId();

    // TICK-157/159 — stripeAccountId Connect (acct_xxx) du restaurant
    const stripeAccountId = restaurantId ? await getStripeAccountId(restaurantId) : null;

    // ── Récupération et validation des prix depuis la BDD ─────────────────────
    const produitIds = produitsClient.map((p) => p.produitId);
    const produitIdsUniques = [...new Set(produitIds)];
    const produitsDB = await Produit.find({
      _id: { $in: produitIdsUniques },
      restaurantId,   // TICK-133 — filtre par tenant
      actif: true,
    }).lean();

    if (produitsDB.length !== produitIdsUniques.length) {
      return NextResponse.json(
        { error: 'Un ou plusieurs produits sont invalides ou indisponibles' },
        { status: 400 }
      );
    }

    const produitMap = new Map(produitsDB.map((p) => [p._id.toString(), p]));

    const produitsVerifies = produitsClient.map((p) => {
      const produitDB = produitMap.get(p.produitId);
      if (!produitDB) throw new Error(`Produit introuvable: ${p.produitId}`);

      const optionsVerifiees = p.options.map((optClient) => {
        const optDB = produitDB.options.find((o) => o.nom === optClient.nom);
        if (!optDB) throw new Error(`Option inconnue "${optClient.nom}" pour le produit "${produitDB.nom}"`);
        return { nom: optDB.nom, prix: optDB.prix };
      });

      return {
        produitId: p.produitId,
        nom: produitDB.nom,
        prix: produitDB.prix,
        quantite: p.quantite,
        taux_tva: produitDB.taux_tva ?? 10,
        options: optionsVerifiees,
      };
    });

    // ── Stripe Connect requis ─────────────────────────────────────────────────
    // Si le restaurant n'a pas finalisé son onboarding Stripe Connect, les commandes
    // sont bloquées (le frontend affiche déjà le restaurant comme fermé via site-config).
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'Les commandes sont temporairement indisponibles. Le restaurant n\'est pas encore configuré pour les paiements en ligne.' },
        { status: 503 }
      );
    }

    // ── Mode réel (Stripe Connect — direct charge) ────────────────────────────
    // TICK-177 — expiresAt à +24h : filet TTL si le webhook n'arrive jamais
    // (24h car Stripe retente jusqu'à 3 jours — voir commentaire dans models/PendingOrder.ts)
    const pendingOrderExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const pendingOrder = await PendingOrder.create({
      client: {
        nom: client.nom,
        telephone: client.telephone,
        ...(client.email ? { email: client.email } : {}),
      },
      retrait,
      ...(commentaire ? { commentaire } : {}),
      produits: produitsVerifies,
      ...(clientId ? { clientId } : {}),
      restaurantId, // TICK-134
      expiresAt: pendingOrderExpiresAt,
    });

    const lineItems = produitsVerifies.map((p) => {
      const prixUnitaire = p.prix + p.options.reduce((s, o) => s + o.prix, 0);
      const nomComplet =
        p.options.length > 0
          ? `${p.nom} (${p.options.map((o) => o.nom).join(', ')})`
          : p.nom;
      return {
        price_data: {
          currency: 'eur',
          product_data: { name: nomComplet },
          unit_amount: prixUnitaire,
        },
        quantity: p.quantite,
      };
    });

    // Commission plateforme (TICK-171 — env var STRIPE_APPLICATION_FEE_PERCENT, pas en DB)
    const totalCentimes = produitsVerifies.reduce(
      (sum, p) => sum + (p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite,
      0
    );
    const platformFeePercent = process.env.STRIPE_APPLICATION_FEE_PERCENT
      ? parseFloat(process.env.STRIPE_APPLICATION_FEE_PERCENT)
      : null;
    const applicationFeeAmount =
      platformFeePercent && platformFeePercent > 0
        ? Math.round(totalCentimes * platformFeePercent / 100)
        : undefined;

    // TICK-157/159 — Client platform + direct charge via { stripeAccount: acct_xxx }
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // TICK-176 — payment_method_types omis : Stripe auto-détecte selon le compte connecté
        // (CB, Bancontact, iDEAL…) plutôt que forcer 'card' uniquement
        line_items: lineItems,
        success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/commande?payment=cancelled&session_id={CHECKOUT_SESSION_ID}`,
        ...(client.email ? { customer_email: client.email } : {}),
        ...(applicationFeeAmount
          ? { payment_intent_data: { application_fee_amount: applicationFeeAmount } }
          : {}),
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          pending_order_id: pendingOrder._id.toString(),
        },
      },
      {
        stripeAccount: stripeAccountId!, // direct charge sur le compte restaurant
        idempotencyKey: `checkout_${pendingOrder._id.toString()}`,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('checkout_failed', { route: '/api/checkout' }, error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}

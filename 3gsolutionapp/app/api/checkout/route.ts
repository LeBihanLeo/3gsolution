// TICK-050 — SEC-01 : Validation des prix côté serveur (OWASP A04:2021)
// TICK-075 — clientId injecté dans metadata si client connecté
// TICK-134 — restaurantId injecté dans PendingOrder (multi-tenant)
// TICK-135 — SiteConfig remplacé par getTenantRestaurant()
// TICK-139 — getStripeClient(restaurantId) remplace getStripe()
// TICK-142 — baseUrl dynamique depuis Host header (fix Stripe success_url/cancel_url)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStripeClient } from '@/lib/stripe';
import { mockSessions } from '@/lib/mockStore';
import { connectDB } from '@/lib/mongodb';
import Produit from '@/models/Produit';
import PendingOrder from '@/models/PendingOrder';
import { randomUUID } from 'crypto';
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
    if (nowMin < hO * 60 + mO || nowMin >= hF * 60 + mF) {
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
    const host = request.headers.get('host') ?? 'localhost:3000';
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${proto}://${host}`;

    // TICK-075 — Récupération clientId si client connecté
    const authSession = await getServerSession(authOptions);
    const clientId =
      authSession?.user?.role === 'client' && authSession.user.id
        ? authSession.user.id
        : undefined;

    // TICK-134 — restaurantId du tenant courant
    const restaurantId = await getTenantId();

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

    // ── Mode mock (pas de clé Stripe configurée pour ce restaurant) ───────────
    const hasMockMode = !restaurant?.stripeSecretKey && !process.env.STRIPE_SECRET_KEY;
    if (hasMockMode) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Stripe non configuré pour ce restaurant' }, { status: 500 });
      }
      const mockId = `mock_${randomUUID()}`;
      mockSessions.set(mockId, {
        client: {
          nom: client.nom,
          telephone: client.telephone,
          ...(client.email ? { email: client.email } : {}),
        },
        retrait,
        ...(commentaire ? { commentaire } : {}),
        produits: produitsVerifies,
        ...(clientId ? { clientId } : {}),
        restaurantId,
      });
      return NextResponse.json({ url: `${baseUrl}/mock-checkout?session_id=${mockId}` });
    }

    // ── Mode réel (Stripe) ────────────────────────────────────────────────────
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

    // TICK-139 — getStripeClient(restaurantId) : clé Stripe par restaurant
    const stripe = await getStripeClient(restaurantId);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande?payment=cancelled&session_id={CHECKOUT_SESSION_ID}`,
      ...(client.email ? { customer_email: client.email } : {}),
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: {
        pending_order_id: pendingOrder._id.toString(),
      },
    }, {
      idempotencyKey: `checkout_${pendingOrder._id.toString()}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('checkout_failed', { route: '/api/checkout' }, error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}

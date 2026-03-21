// TICK-050 — SEC-01 : Validation des prix côté serveur (OWASP A04:2021)
// Les prix des produits et options sont systématiquement récupérés depuis MongoDB.
// Les valeurs `prix` envoyées par le client sont ignorées.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { mockSessions } from '@/lib/mockStore';
import { connectDB } from '@/lib/mongodb';
import Produit from '@/models/Produit';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// ─── Validation ───────────────────────────────────────────────────────────────
// Note : les champs `prix` côté client sont intentionnellement exclus du schéma.
// Les prix sont chargés depuis la base de données (source de vérité).

const OptionClientSchema = z.object({
  nom: z.string().min(1),
  // `prix` client volontairement absent — sera résolu depuis la BDD
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
    type: z.enum(['immediat', 'creneau']),
    creneau: z.string().optional(),
  }),
  commentaire: z.string().max(500).optional(),
  produits: z.array(ProduitCheckoutSchema).min(1, 'Le panier est vide').max(50),
  // clientId transmis si l'utilisateur est connecté — lié à la commande par le webhook
  clientId: z.string().optional(),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { client, retrait, commentaire, produits: produitsClient, clientId } = parsed.data;
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

    // ── Récupération et validation des prix depuis la BDD ─────────────────────
    // SEC-01 : on ne fait jamais confiance aux prix envoyés par le client
    await connectDB();

    const produitIds = produitsClient.map((p) => p.produitId);
    const produitIdsUniques = [...new Set(produitIds)];
    const produitsDB = await Produit.find({
      _id: { $in: produitIdsUniques },
      actif: true,
    }).lean();

    if (produitsDB.length !== produitIdsUniques.length) {
      return NextResponse.json(
        { error: 'Un ou plusieurs produits sont invalides ou indisponibles' },
        { status: 400 }
      );
    }

    const produitMap = new Map(produitsDB.map((p) => [p._id.toString(), p]));

    // Résolution des prix BDD pour chaque ligne du panier
    const produitsVerifies = produitsClient.map((p) => {
      const produitDB = produitMap.get(p.produitId);
      if (!produitDB) {
        throw new Error(`Produit introuvable: ${p.produitId}`);
      }

      // Résolution des options — on vérifie que chaque option demandée existe bien
      const optionsVerifiees = p.options.map((optClient) => {
        const optDB = produitDB.options.find((o) => o.nom === optClient.nom);
        if (!optDB) {
          throw new Error(`Option inconnue "${optClient.nom}" pour le produit "${produitDB.nom}"`);
        }
        return { nom: optDB.nom, prix: optDB.prix }; // prix issu de la BDD
      });

      return {
        produitId: p.produitId,
        nom: produitDB.nom,              // nom issu de la BDD
        prix: produitDB.prix,            // prix issu de la BDD
        quantite: p.quantite,
        options: optionsVerifiees,
      };
    });

    // ── Mode mock (STRIPE_SECRET_KEY absent) ──────────────────────────────────
    if (!process.env.STRIPE_SECRET_KEY) {
      const mockId = `mock_${randomUUID()}`;
      mockSessions.set(mockId, {
        client: {
          nom: client.nom,
          telephone: client.telephone,
          ...(client.email ? { email: client.email } : {}),
        },
        retrait,
        ...(commentaire ? { commentaire } : {}),
        produits: produitsVerifies, // produits avec prix BDD
      });
      return NextResponse.json({ url: `${baseUrl}/mock-checkout?session_id=${mockId}` });
    }

    // ── Mode réel (Stripe) — avec prix vérifiés BDD ───────────────────────────
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
          unit_amount: prixUnitaire, // ← prix BDD, non manipulable par le client
        },
        quantity: p.quantite,
      };
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande`,
      metadata: {
        client_nom: client.nom,
        client_telephone: client.telephone,
        // RGPD minimisation : email transmis uniquement s'il est fourni
        client_email: client.email ?? '',
        retrait_type: retrait.type,
        retrait_creneau: retrait.creneau ?? '',
        commentaire: commentaire ?? '',
        produits: JSON.stringify(produitsVerifies), // snapshot prix BDD
        // Identifiant du compte client (vide pour commandes anonymes)
        client_id: clientId ?? '',
      },
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

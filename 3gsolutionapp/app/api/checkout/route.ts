// TICK-050 — SEC-01 : Validation des prix côté serveur (OWASP A04:2021)
// Les prix des produits et options sont systématiquement récupérés depuis MongoDB.
// Les valeurs `prix` envoyées par le client sont ignorées.
// TICK-075 — clientId injecté dans metadata si client connecté
//
// Stripe best practices appliquées :
//   - PendingOrder (MongoDB TTL 1h) : évite la limite 500 chars/valeur metadata Stripe
//   - customer_email : pré-remplit le formulaire Stripe si l'email est fourni
//   - expires_at : session Stripe expire après 30 min (créneaux restaurant)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { mockSessions } from '@/lib/mockStore';
import { connectDB } from '@/lib/mongodb';
import Produit from '@/models/Produit';
import SiteConfig from '@/models/SiteConfig';
import PendingOrder from '@/models/PendingOrder';
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
    type: z.literal('creneau'),
    creneau: z.string().min(1, 'Un créneau est requis'),
  }),
  commentaire: z.string().max(500).optional(),
  produits: z.array(ProduitCheckoutSchema).min(1, 'Le panier est vide').max(50),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // TICK-105 — Vérifier si la boutique est fermée pour aujourd'hui
    await connectDB();
    const siteConfig = await SiteConfig.findOne().lean() as {
      fermeeAujourdhui?: boolean;
      horaireOuverture?: string;
      horaireFermeture?: string;
    } | null;

    if (siteConfig?.fermeeAujourdhui) {
      return NextResponse.json(
        { error: 'La boutique est fermée pour aujourd\'hui.' },
        { status: 503 }
      );
    }

    // CVE-03 — Vérifier les heures d'ouverture en heure locale Paris (pas UTC)
    // Les serveurs Vercel opèrent en UTC. Date.getHours() retourne l'heure UTC,
    // ce qui cause un décalage de 1h (hiver) à 2h (été) par rapport à l'heure française.
    const ouvertureStr = siteConfig?.horaireOuverture ?? '11:30';
    const fermetureStr = siteConfig?.horaireFermeture ?? '14:00';
    const now = new Date();
    // Extraire heure et minutes dans le fuseau Europe/Paris via Intl
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
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

    // TICK-075 — Récupération clientId si client connecté (session JWT)
    const authSession = await getServerSession(authOptions);
    const clientId =
      authSession?.user?.role === 'client' && authSession.user.id
        ? authSession.user.id
        : undefined;

    // ── Récupération et validation des prix depuis la BDD ─────────────────────
    // SEC-01 : on ne fait jamais confiance aux prix envoyés par le client
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
        taux_tva: produitDB.taux_tva ?? 10, // TICK-129 — snapshot fiscal
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
        ...(clientId ? { clientId } : {}),
      });
      return NextResponse.json({ url: `${baseUrl}/mock-checkout?session_id=${mockId}` });
    }

    // ── Mode réel (Stripe) — avec prix vérifiés BDD ───────────────────────────

    // Stocker le snapshot complet en BDD avant de créer la session Stripe.
    // Stripe limite chaque valeur de métadonnée à 500 chars : le JSON de 4+ items
    // avec options dépasserait la limite, causant une troncature silencieuse et
    // l'échec du parse dans le webhook. On ne passe que l'ID (24 chars) en metadata.
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
          unit_amount: prixUnitaire, // ← prix BDD, non manipulable par le client
        },
        quantity: p.quantite,
      };
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Restreindre aux méthodes de paiement synchrones uniquement.
      // Exclut tout ce qui est delayed/async (SEPA, BACS, ACH, Sofort…) —
      // incompatible avec un restaurant où la commande doit être confirmée immédiatement.
      // `card` inclut automatiquement Apple Pay et Google Pay via Stripe Checkout.
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande?payment=cancelled`,
      // Pré-remplit le champ email sur la page de paiement Stripe si fourni
      ...(client.email ? { customer_email: client.email } : {}),
      // Session expire après 30 min — adapté aux créneaux horaires restaurant
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      metadata: {
        // Référence vers le snapshot complet (évite la limite 500 chars/valeur Stripe)
        pending_order_id: pendingOrder._id.toString(),
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

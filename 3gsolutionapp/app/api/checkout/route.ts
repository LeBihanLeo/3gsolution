import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { mockSessions } from '@/lib/mockStore';
import { randomUUID } from 'crypto';

// ─── Validation ───────────────────────────────────────────────────────────────

const OptionSchema = z.object({
  nom: z.string().min(1),
  prix: z.number().int().min(0),
});

const ProduitCheckoutSchema = z.object({
  produitId: z.string(),
  nom: z.string().min(1),
  prix: z.number().int().min(0),
  quantite: z.number().int().min(1),
  options: z.array(OptionSchema).default([]),
});

const CheckoutSchema = z.object({
  client: z.object({
    nom: z.string().min(2, 'Nom requis'),
    telephone: z.string().min(1, 'Téléphone requis'),
    email: z.string().email().optional().or(z.literal('')),
  }),
  retrait: z.object({
    type: z.enum(['immediat', 'creneau']),
    creneau: z.string().optional(),
  }),
  commentaire: z.string().optional(),
  produits: z.array(ProduitCheckoutSchema).min(1, 'Le panier est vide'),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { client, retrait, commentaire, produits } = parsed.data;
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

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
        produits,
      });
      return NextResponse.json({ url: `${baseUrl}/mock-checkout?session_id=${mockId}` });
    }

    // ── Mode réel (Stripe) ────────────────────────────────────────────────────
    const lineItems = produits.map((p) => {
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

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/commande`,
      metadata: {
        client_nom: client.nom,
        client_telephone: client.telephone,
        client_email: client.email ?? '',
        retrait_type: retrait.type,
        retrait_creneau: retrait.creneau ?? '',
        commentaire: commentaire ?? '',
        produits: JSON.stringify(produits),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Erreur création session Stripe:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}

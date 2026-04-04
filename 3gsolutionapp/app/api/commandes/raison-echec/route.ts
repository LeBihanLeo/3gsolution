import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

// CVE-07 — Même regex que /api/commandes/suivi
const SESSION_ID_REGEX = /^cs_(live|test)_[a-zA-Z0-9]{20,100}$/;

// Messages utilisateur localisés par code de refus Stripe
// Volontairement vagues pour ne pas exposer d'information sensible
const MESSAGES_REFUS: Record<string, string> = {
  card_declined:             'Votre carte a été refusée par votre banque.',
  insufficient_funds:        'Solde insuffisant sur votre compte.',
  expired_card:              'Votre carte est expirée.',
  incorrect_cvc:             'Le code de sécurité (CVV) est incorrect.',
  incorrect_number:          'Le numéro de carte est incorrect.',
  card_velocity_exceeded:    'Limite de paiement dépassée. Réessayez plus tard.',
  do_not_honor:              'Votre banque a refusé le paiement. Contactez-la pour en savoir plus.',
  processing_error:          'Erreur de traitement bancaire. Réessayez.',
  fraudulent:                'Paiement refusé pour des raisons de sécurité.',
  lost_card:                 'Cette carte est signalée comme perdue.',
  stolen_card:               'Cette carte est signalée comme volée.',
  card_not_supported:        'Votre carte n\'est pas acceptée pour ce type de paiement.',
  currency_not_supported:    'La devise n\'est pas supportée par cette carte.',
  generic_decline:           'Votre paiement a été refusé.',
};

/**
 * GET /api/commandes/raison-echec?session_id=cs_xxx
 *
 * Endpoint public — retourne un message de refus localisé si disponible.
 * N'expose jamais les données brutes Stripe ni les informations personnelles.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  // Validation stricte — mock sessions n'ont pas de raison Stripe
  if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
    return NextResponse.json({ raison: null });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ raison: null });
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    // Si la session est complétée, pas de raison de refus pertinente
    if (session.status === 'complete') {
      return NextResponse.json({ raison: null });
    }

    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    if (!pi?.last_payment_error) {
      return NextResponse.json({ raison: null });
    }

    // Utiliser decline_code en priorité (plus précis), sinon le code générique
    const code =
      pi.last_payment_error.decline_code ??
      pi.last_payment_error.code ??
      'generic_decline';

    const raison = MESSAGES_REFUS[code] ?? MESSAGES_REFUS['generic_decline'];

    return NextResponse.json({ raison });
  } catch {
    // En cas d'erreur Stripe (session introuvable, etc.) : silencieux
    return NextResponse.json({ raison: null });
  }
}

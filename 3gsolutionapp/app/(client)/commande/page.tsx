'use client';
// TICK-088 — BackLink retour vers le panier
// TICK-XXX — Raison de refus Stripe affichée si session_id présent dans l'URL

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cartContext';
import FormulaireCommande from '@/components/client/FormulaireCommande';
import { BackLink } from '@/components/ui';

// Banner affiché quand l'utilisateur revient depuis une session Stripe annulée/échouée.
// Isolé dans un composant Suspense car useSearchParams requiert une boundary en Next.js.
function PaymentCancelledBanner() {
  const params = useSearchParams();
  const [raison, setRaison] = useState<string | null>(null);

  const sessionId = params.get('session_id');
  const isCancelled = params.get('payment') === 'cancelled';

  useEffect(() => {
    if (!isCancelled || !sessionId) return;

    // Tentative de récupération de la raison de refus — silencieuse si indisponible
    fetch(`/api/commandes/raison-echec?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.raison) setRaison(data.raison);
      })
      .catch(() => {/* silencieux */});
  }, [isCancelled, sessionId]);

  if (!isCancelled) return null;

  return (
    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <p className="font-medium">Votre paiement a été annulé ou refusé.</p>
      {raison && <p className="mt-1 text-red-600">{raison}</p>}
      <p className="mt-1 text-red-500">Vos articles sont toujours dans le panier, vous pouvez réessayer.</p>
    </div>
  );
}

export default function CommandePage() {
  const { items } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg mb-4">Votre panier est vide.</p>
        <Link href="/" className="text-orange-600 hover:text-orange-700 text-sm transition-colors">
          ← Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <BackLink href="/panier" label="Retour au panier" />
      </div>
      <Suspense>
        <PaymentCancelledBanner />
      </Suspense>
      <FormulaireCommande />
    </>
  );
}

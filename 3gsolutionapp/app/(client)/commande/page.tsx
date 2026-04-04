'use client';
// TICK-088 — BackLink retour vers le panier

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/lib/cartContext';
import FormulaireCommande from '@/components/client/FormulaireCommande';
import { BackLink } from '@/components/ui';

// Banner affiché quand l'utilisateur revient depuis une session Stripe annulée/échouée.
// Isolé dans un composant Suspense car useSearchParams requiert une boundary en Next.js.
function PaymentCancelledBanner() {
  const params = useSearchParams();
  if (params.get('payment') !== 'cancelled') return null;

  return (
    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      Votre paiement a été annulé ou refusé. Vos articles sont toujours dans le panier, vous pouvez réessayer.
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

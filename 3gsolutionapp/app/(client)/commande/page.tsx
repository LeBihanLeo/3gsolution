'use client';
// TICK-088 — BackLink retour vers le panier

import Link from 'next/link';
import { useCart } from '@/lib/cartContext';
import FormulaireCommande from '@/components/client/FormulaireCommande';
import { BackLink } from '@/components/ui';

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
      <FormulaireCommande />
    </>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart, CartItem } from '@/lib/cartContext';

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function itemTotal(item: CartItem): number {
  return (item.prix + item.options.reduce((s, o) => s + o.prix, 0)) * item.quantite;
}

export default function Panier() {
  const { items, updateQuantity, removeItem, clearCart, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-4xl mb-4">🛒</p>
        <p className="text-gray-600 text-lg mb-6">Votre panier est vide.</p>
        <Link
          href="/"
          className="text-blue-600 hover:underline text-sm"
        >
          ← Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Votre panier</h1>
        <button
          onClick={clearCart}
          className="text-sm text-red-400 hover:text-red-600 hover:underline"
        >
          Vider le panier
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              {item.imageUrl && (
                <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-gray-100">
                  <Image
                    src={item.imageUrl}
                    alt={item.nom}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-gray-900">{item.nom}</p>
                  <p className="font-bold text-gray-900 whitespace-nowrap">
                    {formatPrix(itemTotal(item))}
                  </p>
                </div>
                {item.options.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    + {item.options.map((o) => o.nom).join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() =>
                  updateQuantity(item.produitId, item.options, item.quantite - 1)
                }
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg leading-none text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Diminuer"
              >
                −
              </button>
              <span className="font-medium w-6 text-center text-gray-900">{item.quantite}</span>
              <button
                onClick={() =>
                  updateQuantity(item.produitId, item.options, item.quantite + 1)
                }
                className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-lg leading-none text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Augmenter"
              >
                +
              </button>
              <button
                onClick={() => removeItem(item.produitId, item.options)}
                className="ml-auto text-xs text-red-400 hover:underline"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 font-medium">Total</span>
          <span className="text-xl font-bold text-gray-900">{formatPrix(totalPrice)}</span>
        </div>
      </div>

      <Link
        href="/commande"
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-3 rounded-xl transition-colors"
      >
        Commander →
      </Link>

      <div className="text-center mt-4">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

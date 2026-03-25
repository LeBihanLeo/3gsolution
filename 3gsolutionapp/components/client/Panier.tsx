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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        <p className="text-gray-900 font-semibold text-lg mb-1">Panier vide</p>
        <p className="text-gray-500 text-sm mb-6">Ajoutez des articles depuis le menu.</p>
        <Link
          href="/"
          className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
        >
          ← Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          Votre panier
          <span className="ml-2 text-sm font-medium text-gray-400">({items.length} article{items.length > 1 ? 's' : ''})</span>
        </h1>
        <button
          onClick={clearCart}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Tout vider
        </button>
      </div>

      <div className="space-y-3 mb-5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-start gap-3">
              {item.imageUrl && (
                <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden">
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
                  <p className="font-semibold text-gray-900 leading-tight">{item.nom}</p>
                  <p className="font-bold text-gray-900 whitespace-nowrap text-sm">
                    {formatPrix(itemTotal(item))}
                  </p>
                </div>
                {item.options.length > 0 && (
                  <p className="text-xs text-orange-600 mt-0.5">
                    + {item.options.map((o) => o.nom).join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
              <button
                onClick={() => updateQuantity(item.produitId, item.options, item.quantite - 1)}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors text-lg leading-none"
                aria-label="Diminuer"
              >
                −
              </button>
              <span className="font-semibold w-6 text-center text-gray-900 text-sm">{item.quantite}</span>
              <button
                onClick={() => updateQuantity(item.produitId, item.options, item.quantite + 1)}
                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors text-lg leading-none"
                aria-label="Augmenter"
              >
                +
              </button>
              <button
                onClick={() => removeItem(item.produitId, item.options)}
                className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Récap total */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm font-medium">Total estimé</span>
          <span className="text-2xl font-bold text-gray-900">{formatPrix(totalPrice)}</span>
        </div>
      </div>

      <Link
        href="/commande"
        className="block w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-center font-semibold py-3.5 rounded-2xl transition-colors"
      >
        Commander →
      </Link>

      <div className="text-center mt-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-orange-600 transition-colors">
          ← Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

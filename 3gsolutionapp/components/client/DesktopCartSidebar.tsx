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

export default function DesktopCartSidebar() {
  const { items, totalPrice, totalItems } = useCart();

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-base">Mon panier</h2>
          {totalItems > 0 && (
            <span className="text-xs text-gray-400 font-medium">
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Votre panier est vide</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  {item.imageUrl && (
                    <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={item.imageUrl}
                        alt={item.nom}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.nom}</p>
                    {item.options.length > 0 && (
                      <p className="text-xs text-orange-500 truncate mt-0.5">
                        {item.options.map((o) => o.nom).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">×{item.quantite}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 shrink-0">{formatPrix(itemTotal(item))}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 mb-4 space-y-1">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Sous-total</span>
                <span>{formatPrix(totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-gray-900 text-base">{formatPrix(totalPrice)}</span>
              </div>
            </div>

            <Link
              href="/panier"
              className="block w-full text-center font-semibold py-2.5 rounded-xl transition-colors text-sm text-[color:var(--color-primary-fg,#fff)] [background-color:var(--color-primary,#E63946)] hover:[background-color:var(--color-primary-dark,#b02030)]"
            >
              Commander →
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}

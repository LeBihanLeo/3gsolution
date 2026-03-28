'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart, CartOption, buildOptionsKey } from '@/lib/cartContext';

interface Option {
  nom: string;
  prix: number; // centimes
}

interface MenuCardProps {
  produitId: string;
  nom: string;
  description: string;
  prix: number; // centimes
  options: Option[];
  imageUrl?: string;
  // TICK-105 — Désactiver les boutons si boutique fermée
  disabled?: boolean;
}

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuCard({ produitId, nom, description, prix, options, imageUrl, disabled = false }: MenuCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const [selectedOptions, setSelectedOptions] = useState<CartOption[]>([]);
  const [showOptions, setShowOptions] = useState(false);

  // Quantité en panier pour la sélection courante (options cochées ou aucune)
  const cartItem = items.find(
    (i) => i.produitId === produitId && buildOptionsKey(i.options) === buildOptionsKey(selectedOptions)
  );
  const quantite = cartItem?.quantite ?? 0;

  const toggleOption = (opt: Option) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.nom === opt.nom);
      return exists ? prev.filter((o) => o.nom !== opt.nom) : [...prev, { nom: opt.nom, prix: opt.prix }];
    });
  };

  const totalItem = prix + selectedOptions.reduce((s, o) => s + o.prix, 0);

  const handleAdd = () => {
    if (disabled) return;
    addItem({ produitId, nom, prix, quantite: 1, options: selectedOptions, imageUrl });
    setSelectedOptions([]);
    setShowOptions(false);
  };

  const handleIncrement = () => {
    updateQuantity(produitId, selectedOptions, quantite + 1);
  };

  const handleDecrement = () => {
    updateQuantity(produitId, selectedOptions, quantite - 1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Image à gauche */}
          {imageUrl && (
            <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden">
              <Image
                src={imageUrl}
                alt={nom}
                fill
                className="object-cover"
                loading="lazy"
                sizes="96px"
              />
            </div>
          )}

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 leading-tight">{nom}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{description}</p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-base font-bold text-gray-900">{formatPrix(prix)}</span>
                {selectedOptions.length > 0 && (
                  <span className="ml-2 text-sm font-medium [color:var(--color-primary,#E63946)]">
                    → {formatPrix(totalItem)}
                  </span>
                )}
              </div>

              {/* Action droite */}
              {quantite > 0 ? (
                /* Stepper — pour toutes les cartes dès qu'un item correspondant est au panier */
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDecrement}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-lg leading-none transition-colors [border-color:var(--color-primary,#E63946)] [color:var(--color-primary,#E63946)] hover:[background-color:var(--color-surface,#fdf0f0)] active:[background-color:var(--color-surface,#fdf0f0)]"
                    aria-label="Retirer un"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-gray-900 text-sm">{quantite}</span>
                  <button
                    onClick={handleIncrement}
                    className="w-8 h-8 rounded-full text-[color:var(--color-primary-fg,#fff)] flex items-center justify-center font-bold text-lg leading-none transition-colors [background-color:var(--color-primary,#E63946)] hover:[background-color:var(--color-primary-dark,#b02030)] active:[background-color:var(--color-primary-dark,#b02030)]"
                    aria-label="Ajouter un"
                  >
                    +
                  </button>
                </div>
              ) : (
                /* Bouton + rond */
                <button
                  onClick={handleAdd}
                  disabled={disabled}
                  className="w-9 h-9 rounded-full text-[color:var(--color-primary-fg,#fff)] flex items-center justify-center shrink-0 text-xl font-bold leading-none transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed [background-color:var(--color-primary,#E63946)] hover:[background-color:var(--color-primary-dark,#b02030)] active:[background-color:var(--color-primary-dark,#b02030)]"
                  aria-label={`Ajouter ${nom} au panier`}
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>

        {options.length > 0 && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="mt-3 text-xs font-medium flex items-center gap-1 transition-colors [color:var(--color-primary,#E63946)]"
          >
            <span>{showOptions ? '▲' : '▼'}</span>
            <span>{showOptions ? 'Masquer les options' : 'Personnaliser'}</span>
          </button>
        )}

        {showOptions && (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            {options.map((opt) => (
              <label key={opt.nom} className="flex items-center gap-3 text-sm cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={!!selectedOptions.find((o) => o.nom === opt.nom)}
                  onChange={() => toggleOption(opt)}
                  className="rounded accent-orange-500 w-4 h-4"
                />
                <span className="flex-1 text-gray-800 group-hover:text-gray-900">{opt.nom}</span>
                <span className="font-medium [color:var(--color-primary,#E63946)]">+{formatPrix(opt.prix)}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

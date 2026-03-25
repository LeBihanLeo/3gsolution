'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart, CartOption } from '@/lib/cartContext';

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
}

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function MenuCard({ produitId, nom, description, prix, options, imageUrl }: MenuCardProps) {
  const { addItem } = useCart();
  const [selectedOptions, setSelectedOptions] = useState<CartOption[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [added, setAdded] = useState(false);

  const toggleOption = (opt: Option) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.nom === opt.nom);
      return exists ? prev.filter((o) => o.nom !== opt.nom) : [...prev, { nom: opt.nom, prix: opt.prix }];
    });
  };

  const totalItem = prix + selectedOptions.reduce((s, o) => s + o.prix, 0);

  const handleAdd = () => {
    addItem({ produitId, nom, prix, quantite: 1, options: selectedOptions, imageUrl });
    setSelectedOptions([]);
    setShowOptions(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Infos à gauche */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 leading-tight">{nom}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{description}</p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-base font-bold text-gray-900">{formatPrix(prix)}</span>
                {selectedOptions.length > 0 && (
                  <span className="ml-2 text-sm text-orange-600 font-medium">
                    → {formatPrix(totalItem)}
                  </span>
                )}
              </div>

              <button
                onClick={handleAdd}
                className={`shrink-0 text-sm font-semibold px-4 py-1.5 rounded-xl transition-all duration-200 ${
                  added
                    ? 'bg-green-500 text-white'
                    : 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {added ? '✓ Ajouté' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Image à droite */}
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
        </div>

        {options.length > 0 && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
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
                  className="rounded accent-orange-600 w-4 h-4"
                />
                <span className="flex-1 text-gray-800 group-hover:text-gray-900">{opt.nom}</span>
                <span className="text-orange-600 font-medium">+{formatPrix(opt.prix)}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

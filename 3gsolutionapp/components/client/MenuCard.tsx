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
  imageUrl?: string; // TICK-038
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Image carrée à gauche — TICK-038 */}
          {imageUrl && (
            <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-100">
              <Image
                src={imageUrl}
                alt={nom}
                fill
                className="object-cover"
                loading="lazy"
                sizes="80px"
              />
            </div>
          )}

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-semibold text-gray-900">{nom}</h3>
              <span className="font-bold text-gray-900 whitespace-nowrap shrink-0">{formatPrix(prix)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>

        {options.length > 0 && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            {showOptions ? '▲ Masquer les options' : '▼ Voir les options'}
          </button>
        )}

        {showOptions && (
          <div className="mt-2 space-y-1.5 border-t pt-2">
            {options.map((opt) => (
              <label key={opt.nom} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!selectedOptions.find((o) => o.nom === opt.nom)}
                  onChange={() => toggleOption(opt)}
                  className="rounded accent-blue-600"
                />
                <span className="flex-1 text-gray-900">{opt.nom}</span>
                <span className="text-gray-700">+{formatPrix(opt.prix)}</span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {selectedOptions.length > 0 && (
            <span className="text-sm text-gray-600 font-medium">
              Total : {formatPrix(totalItem)}
            </span>
          )}
          <button
            onClick={handleAdd}
            className={`ml-auto text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-all ${
              added
                ? 'bg-green-500'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {added ? '✓ Ajouté' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

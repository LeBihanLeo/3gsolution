'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MenuCard from '@/components/client/MenuCard';
import { useCart } from '@/lib/cartContext';

interface Option {
  nom: string;
  prix: number;
}

interface Produit {
  _id: string;
  nom: string;
  description: string;
  categorie: string;
  prix: number;
  options: Option[];
  imageUrl?: string; // TICK-038
}

export default function MenuPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { totalItems } = useCart();

  useEffect(() => {
    fetch('/api/produits')
      .then((res) => res.json())
      .then((data) => {
        setProduits(data.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const categories = Array.from(new Set(produits.map((p) => p.categorie)));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notre Menu</h1>

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-500 text-center py-12">
          Impossible de charger le menu. Veuillez réessayer.
        </p>
      )}

      {!loading && !error && produits.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          Aucun produit disponible pour le moment.
        </p>
      )}

      {!loading &&
        !error &&
        categories.map((categorie) => (
          <section key={categorie} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
              {categorie}
            </h2>
            <div className="space-y-3">
              {produits
                .filter((p) => p.categorie === categorie)
                .map((p) => (
                  <MenuCard
                    key={p._id}
                    produitId={p._id}
                    nom={p.nom}
                    description={p.description}
                    prix={p.prix}
                    options={p.options}
                    imageUrl={p.imageUrl}
                  />
                ))}
            </div>
          </section>
        ))}

      {/* Bouton panier flottant */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
          <Link
            href="/panier"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full shadow-lg flex items-center gap-3 transition-colors"
          >
            <span>Voir le panier</span>
            <span className="bg-white text-blue-600 rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center">
              {totalItems}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MenuCard from '@/components/client/MenuCard';
import { Button } from '@/components/ui';
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
  imageUrl?: string;
}

// ─── Écran de choix ────────────────────────────────────────────────────────

function EcranChoix({ onInvite }: { onInvite: () => void }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z" />
        </svg>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenue !</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
          Connectez-vous pour retrouver vos commandes passées, ou continuez directement.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => router.push('/auth/login')}
        >
          Se connecter
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          onClick={onInvite}
        >
          Continuer en tant qu&apos;invité
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton loading ─────────────────────────────────────────────────────

function MenuSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Menu ─────────────────────────────────────────────────────────────────

function Menu() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Tout');
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
  const tabs = ['Tout', ...categories];

  const filtered = activeCategory === 'Tout'
    ? produits
    : produits.filter((p) => p.categorie === activeCategory);

  return (
    <div>
      {/* Tabs catégories */}
      {!loading && !error && produits.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide -mx-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 ${
                activeCategory === tab
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {loading && <MenuSkeleton />}

      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Impossible de charger le menu.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-orange-500 hover:underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && produits.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Aucun article disponible pour le moment.</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map((p) => (
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
      )}

      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
          <Link
            href="/panier"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-orange-200 flex items-center gap-3 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Voir le panier</span>
            <span className="bg-white text-orange-500 rounded-full text-xs font-bold w-5 h-5 flex items-center justify-center">
              {totalItems}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────

export default function MenuPage() {
  const { data: session, status } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('guest_mode') === 'true') {
        setShowMenu(true);
      }
    }
  }, []);

  if (status === 'authenticated' && session?.user?.role === 'client') {
    return <Menu />;
  }

  if (status === 'loading') {
    return <MenuSkeleton />;
  }

  if (showMenu) {
    return <Menu />;
  }

  return (
    <EcranChoix
      onInvite={() => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('guest_mode', 'true');
        }
        setShowMenu(true);
      }}
    />
  );
}

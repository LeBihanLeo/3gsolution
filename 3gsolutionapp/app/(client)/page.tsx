'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import MenuCard from '@/components/client/MenuCard';
import { Button } from '@/components/ui';

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
  // TICK-105 — Fermeture boutique
  const [fermeeAujourdhui, setFermeeAujourdhui] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('cat') ?? 'Tout';

  const handleCategoryChange = (cat: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'Tout') {
      params.delete('cat');
    } else {
      params.set('cat', cat);
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : '/', { scroll: false });
  };

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

  // TICK-105 — Charger SiteConfig pour fermeeAujourdhui
  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then(({ data }) => setFermeeAujourdhui(data?.fermeeAujourdhui ?? false))
      .catch(() => {});
  }, []);

  const categories = Array.from(new Set(produits.map((p) => p.categorie)));
  const tabs = ['Tout', ...categories];

  const filtered = activeCategory === 'Tout'
    ? produits
    : produits.filter((p) => p.categorie === activeCategory);

  return (
    <div>
      {/* TICK-105 — Bandeau boutique fermée */}
      {fermeeAujourdhui && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700 font-medium text-center">
          La boutique est fermée pour aujourd&apos;hui. Revenez demain !
        </div>
      )}

      {/* Tabs catégories — mobiles uniquement (sidebar sur desktop) */}
      {!loading && !error && produits.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide -mx-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleCategoryChange(tab)}
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
              disabled={fermeeAujourdhui}
            />
          ))}
        </div>
      )}

    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────

function MenuPage() {
  const { data: session, status } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('guest_mode') === 'true') {
        setShowMenu(true);
      }
    }
  }, []);

  if (status === 'authenticated') {
    return (
      <Suspense fallback={<MenuSkeleton />}>
        <Menu />
      </Suspense>
    );
  }

  if (status === 'loading') {
    return <MenuSkeleton />;
  }

  if (showMenu) {
    return (
      <Suspense fallback={<MenuSkeleton />}>
        <Menu />
      </Suspense>
    );
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

export default MenuPage;

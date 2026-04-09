'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import DesktopCategorySidebar from './DesktopCategorySidebar';
import DesktopCartSidebar from './DesktopCartSidebar';
import { useCart } from '@/lib/cartContext';

interface Props {
  children: ReactNode;
  banniereUrl?: string;
  horaireOuverture: string;
  horaireFermeture: string;
  fermeeAujourdhui: boolean;
}

function HorairePill({
  fermeeAujourdhui,
  horaireOuverture,
  horaireFermeture,
}: {
  fermeeAujourdhui: boolean;
  horaireOuverture: string;
  horaireFermeture: string;
}) {
  if (fermeeAujourdhui) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Fermé aujourd&apos;hui
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {horaireOuverture} – {horaireFermeture}
    </span>
  );
}

export default function DesktopMenuShell({
  children,
  banniereUrl,
  horaireOuverture,
  horaireFermeture,
  fermeeAujourdhui,
}: Props) {
  const pathname = usePathname();
  const isMenu = pathname === '/';
  const { totalItems } = useCart();

  if (!isMenu) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 w-full">

      {/* ── Bannière mobile (pleine largeur, cachée sur desktop) ── */}
      {banniereUrl && (
        <div
          className="lg:hidden w-full relative"
          style={{
            backgroundImage: `url(${banniereUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '220px',
          }}
        >
          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-b from-transparent to-stone-50" />
          <div className="absolute bottom-4 left-4 z-10">
            <HorairePill
              fermeeAujourdhui={fermeeAujourdhui}
              horaireOuverture={horaireOuverture}
              horaireFermeture={horaireFermeture}
            />
          </div>
        </div>
      )}

      {/* ── Grille (mobile : colonne unique, desktop : [spacer] [menu] [panier]) ── */}
      {/* children rendu UNE SEULE FOIS pour éviter la duplication du state */}
      <div className="lg:flex lg:justify-center lg:gap-6 lg:px-6 lg:py-6 lg:items-start">

        {/* Spacer miroir du panier — force le menu au centre exact de l'écran */}
        <div className="hidden lg:block w-64 xl:w-72 shrink-0" />

        {/* Colonne centrale */}
        <div className="min-w-0 max-w-2xl mx-auto w-full px-4 py-6 lg:w-[672px] lg:shrink-0 lg:mx-0 lg:px-0 lg:py-0">

          {/* Bannière desktop (dans la colonne centrale, cachée sur mobile) */}
          {banniereUrl && (
            <div
              className="hidden lg:block w-full relative rounded-2xl overflow-hidden mb-5"
              style={{
                backgroundImage: `url(${banniereUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '220px',
              }}
            >
              <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-b from-transparent to-stone-50" />
              <div className="absolute bottom-4 left-4 z-10">
                <HorairePill
                  fermeeAujourdhui={fermeeAujourdhui}
                  horaireOuverture={horaireOuverture}
                  horaireFermeture={horaireFermeture}
                />
              </div>
            </div>
          )}

          {children}
        </div>

        {/* Sidebar panier — se masque elle-même sur mobile */}
        <DesktopCartSidebar />
      </div>

      {/* Bouton panier flottant — mobile uniquement, page menu uniquement */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-[60] lg:hidden">
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
    </main>
  );
}

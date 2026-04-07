'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import DesktopCategorySidebar from './DesktopCategorySidebar';
import DesktopCartSidebar from './DesktopCartSidebar';

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
  const { status } = useSession();
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    setGuestMode(sessionStorage.getItem('guest_mode') === 'true');
  }, []);

  // Masquer le panier desktop pendant l'EcranChoix (non authentifié + pas en mode invité)
  const showCart = !(status === 'unauthenticated' && !guestMode);

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
        {showCart && <div className="hidden lg:block w-64 xl:w-72 shrink-0" />}

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

        {/* Sidebar panier — masquée sur mobile et pendant l'EcranChoix */}
        {showCart && <DesktopCartSidebar />}
      </div>
    </main>
  );
}

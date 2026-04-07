// TICK-137 — Server Component : lit x-tenant-id (injecté par middleware TICK-132)
//             et requête Restaurant pour les CSS vars palette + config vitrine.
//             SiteConfig n'est plus utilisé dans ce layout.
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';
import UserNavButton from '@/components/client/UserNavButton';
import DesktopMenuShell from '@/components/client/DesktopMenuShell';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { generatePalette, SitePalette } from '@/lib/palette';

const DEFAULT_COULEUR = '#E63946';

interface SiteConfigData {
  nomRestaurant: string;
  banniereUrl?: string;
  palette: SitePalette;
  horaireOuverture: string;
  horaireFermeture: string;
  fermeeAujourdhui: boolean;
}

const DEFAULT_CONFIG: SiteConfigData = {
  nomRestaurant: 'Mon Restaurant',
  palette: generatePalette(DEFAULT_COULEUR),
  horaireOuverture: '11:30',
  horaireFermeture: '14:00',
  fermeeAujourdhui: false,
};

// TICK-137 — Lecture Restaurant depuis x-tenant-id (header injecté par le middleware)
async function getSiteConfig(): Promise<SiteConfigData> {
  try {
    const hdrs = await headers();
    const tenantId = hdrs.get('x-tenant-id');

    await connectDB();

    const restaurant = tenantId
      ? await Restaurant.findById(tenantId)
          .select('nomRestaurant banniereUrl couleurPrincipale horaireOuverture horaireFermeture fermeeAujourdhui')
          .lean()
      : null;

    if (!restaurant) return DEFAULT_CONFIG;

    const r = restaurant as Record<string, unknown>;
    const couleur = typeof r.couleurPrincipale === 'string' ? r.couleurPrincipale : DEFAULT_COULEUR;

    return {
      nomRestaurant: typeof r.nomRestaurant === 'string' ? r.nomRestaurant : DEFAULT_CONFIG.nomRestaurant,
      banniereUrl: typeof r.banniereUrl === 'string' ? r.banniereUrl : undefined,
      palette: generatePalette(couleur),
      horaireOuverture: typeof r.horaireOuverture === 'string' ? r.horaireOuverture : DEFAULT_CONFIG.horaireOuverture,
      horaireFermeture: typeof r.horaireFermeture === 'string' ? r.horaireFermeture : DEFAULT_CONFIG.horaireFermeture,
      fermeeAujourdhui: typeof r.fermeeAujourdhui === 'boolean' ? r.fermeeAujourdhui : false,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return { title: config.nomRestaurant };
}

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();

  // TICK-123/137 — CSS custom properties injectées sur le conteneur principal (Server Component)
  const cssVars = {
    '--color-primary': config.palette.primary,
    '--color-primary-light': config.palette.primaryLight,
    '--color-primary-dark': config.palette.primaryDark,
    '--color-primary-fg': config.palette.primaryForeground,
    '--color-surface': config.palette.surface,
    '--color-border': config.palette.border,
  } as React.CSSProperties;

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-stone-50" style={cssVars}>

        {/* ── Top bar blanche (commune aux deux cas) ── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-2xl lg:max-w-7xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-bold text-gray-900 text-base uppercase tracking-widest hover:text-orange-600 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {config.nomRestaurant}
            </Link>
            <UserNavButton variant="onWhite" />
          </div>
        </header>

        <DesktopMenuShell
          banniereUrl={config.banniereUrl}
          horaireOuverture={config.horaireOuverture}
          horaireFermeture={config.horaireFermeture}
          fermeeAujourdhui={config.fermeeAujourdhui}
        >
          {children}
        </DesktopMenuShell>

        <footer className="bg-white border-t border-gray-100 text-center text-xs text-gray-400 py-4">
          <Link href="/mentions-legales" className="hover:text-orange-600 transition-colors">
            Mentions légales
          </Link>
          <span className="mx-2 text-gray-200">·</span>
          <span>© {new Date().getFullYear()} {config.nomRestaurant}</span>
        </footer>
      </div>
      <CookieBanner />
    </CartProvider>
  );
}

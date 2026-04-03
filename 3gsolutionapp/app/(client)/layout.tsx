import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';
import UserNavButton from '@/components/client/UserNavButton';
import DesktopMenuShell from '@/components/client/DesktopMenuShell';
import { connectDB } from '@/lib/mongodb';
import SiteConfig from '@/models/SiteConfig';
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

// TICK-123 — no-store : palette fraîche à chaque requête
async function getSiteConfig(): Promise<SiteConfigData> {
  try {
    await connectDB();
    const config = await SiteConfig.findOne().lean();
    if (!config) return DEFAULT_CONFIG;
    const couleur = (config as { couleurPrincipale?: string }).couleurPrincipale ?? DEFAULT_COULEUR;
    return {
      nomRestaurant: config.nomRestaurant,
      banniereUrl: config.banniereUrl,
      palette: generatePalette(couleur),
      horaireOuverture: config.horaireOuverture ?? '11:30',
      horaireFermeture: config.horaireFermeture ?? '14:00',
      fermeeAujourdhui: config.fermeeAujourdhui ?? false,
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

  // TICK-123 — CSS custom properties injectées sur le conteneur principal (Server Component)
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

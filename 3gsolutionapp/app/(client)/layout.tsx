import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';
import UserNavButton from '@/components/client/UserNavButton';
import BannerConditional from '@/components/client/BannerConditional';
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
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
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

        {config.banniereUrl && (
          /* ── Bannière image sous la top bar (menu uniquement) ── */
          <BannerConditional>
            <div
              className="w-full relative"
              style={{
                backgroundImage: `url(${config.banniereUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '220px',
              }}
            >
              {/* Gradient fondu vers stone-50 en bas */}
              <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-b from-transparent to-stone-50" />

              {/* Horaires bas gauche — tag pill */}
              <div className="absolute bottom-4 left-4 z-10">
                {config.fermeeAujourdhui ? (
                  <span className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Fermé aujourd&apos;hui
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {config.horaireOuverture} – {config.horaireFermeture}
                  </span>
                )}
              </div>
            </div>
          </BannerConditional>
        )}

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          {children}
        </main>

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

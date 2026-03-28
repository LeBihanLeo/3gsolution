import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';
import HeaderAuth from '@/components/client/HeaderAuth';
import ProfilButton from '@/components/client/ProfilButton';
import { connectDB } from '@/lib/mongodb';
import SiteConfig from '@/models/SiteConfig';
import { generatePalette, SitePalette } from '@/lib/palette';

const DEFAULT_COULEUR = '#E63946';

interface SiteConfigData {
  nomRestaurant: string;
  banniereUrl?: string;
  palette: SitePalette;
}

const DEFAULT_CONFIG: SiteConfigData = {
  nomRestaurant: 'Mon Restaurant',
  palette: generatePalette(DEFAULT_COULEUR),
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

        {config.banniereUrl ? (
          /* ── Hero bannière ── */
          <header className="w-full">
            <div
              className="w-full flex items-center justify-center relative"
              style={{
                backgroundImage: `url(${config.banniereUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '200px',
              }}
            >
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
              <div className="relative flex items-center gap-5 w-full px-8 max-w-2xl mx-auto">
                <div className="flex-1 h-px bg-white/60" />
                <Link
                  href="/"
                  className="text-white text-2xl whitespace-nowrap shrink-0 uppercase tracking-widest drop-shadow-lg"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                  }}
                >
                  {config.nomRestaurant}
                </Link>
                <div className="flex-1 h-px bg-white/60" />
              </div>
            </div>
          
          </header>
        ) : (
          /* ── Header fallback ── */
          <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
              </div>
              <Link
                href="/"
                className="font-semibold text-gray-900 text-base hover:text-orange-600 transition-colors flex-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {config.nomRestaurant}
              </Link>
              <HeaderAuth />
            </div>
          </header>
        )}

        {/* TICK-116 — relative pour que ProfilButton (absolute top-4 right-4) se positionne ici */}
        <main className="relative flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          <ProfilButton />
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

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';
import { connectDB } from '@/lib/mongodb';
import SiteConfig from '@/models/SiteConfig';

interface SiteConfigData {
  nomRestaurant: string;
  banniereUrl?: string;
}

const DEFAULT_CONFIG: SiteConfigData = {
  nomRestaurant: 'Mon Restaurant',
};

async function getSiteConfig(): Promise<SiteConfigData> {
  try {
    await connectDB();
    const config = await SiteConfig.findOne().lean();
    if (!config) return DEFAULT_CONFIG;
    return {
      nomRestaurant: config.nomRestaurant,
      banniereUrl: config.banniereUrl,
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

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          {config.banniereUrl && (
            <div className="w-full max-h-[200px] overflow-hidden">
              <img
                src={config.banniereUrl}
                alt={`Bannière ${config.nomRestaurant}`}
                className="w-full object-cover max-h-[200px]"
              />
            </div>
          )}
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-2xl">🍔</span>
            <Link href="/" className="font-bold text-gray-900 text-lg hover:text-blue-600 transition-colors">
              {config.nomRestaurant}
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          {children}
        </main>

        <footer className="bg-white border-t text-center text-xs text-gray-400 py-3">
          <Link href="/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
        </footer>
      </div>
      <CookieBanner />
    </CartProvider>
  );
}

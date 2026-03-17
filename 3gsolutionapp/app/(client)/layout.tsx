import type { ReactNode } from 'react';
import Link from 'next/link';
import { CartProvider } from '@/lib/cartContext';
import CookieBanner from '@/components/client/CookieBanner';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-2xl">🍔</span>
            <Link href="/" className="font-bold text-gray-900 text-lg hover:text-blue-600 transition-colors">
              3G Solution
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300 flex-1 min-w-0">
          Ce site utilise un cookie de session pour l&apos;espace administrateur. Aucun
          tracking tiers.{' '}
          <Link href="/mentions-legales" className="underline hover:text-white">
            En savoir plus
          </Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

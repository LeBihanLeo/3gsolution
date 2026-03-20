// TICK-056 — RGPD-01 : Bandeau cookie conforme CNIL (délibération 2020-091)
// Le refus doit être aussi facile que l'acceptation (même visibilité visuelle).
// Le cookie de session admin est strictement nécessaire → exempté de consentement.
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

  // RGPD : le refus doit être enregistré pour que le bandeau ne réapparaisse pas
  const refuse = () => {
    localStorage.setItem(STORAGE_KEY, 'refused');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto flex flex-wrap items-start gap-3">
        <p className="text-sm text-gray-300 flex-1 min-w-0">
          Ce site utilise un cookie de session strictement nécessaire pour
          l&apos;espace administrateur (exempté de consentement). Aucun cookie de
          tracking ou publicitaire.{' '}
          <Link href="/mentions-legales" className="underline hover:text-white">
            En savoir plus
          </Link>
        </p>
        {/* CNIL 2022 : les deux boutons doivent avoir le même poids visuel */}
        <div className="flex shrink-0 gap-2">
          <button
            onClick={refuse}
            className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Refuser
          </button>
          <button
            onClick={accept}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}

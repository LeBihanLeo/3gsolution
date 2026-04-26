'use client';
// TICK-199 — Bannière reminder : affiche un rappel si Stripe n'est pas connecté après onboarding.
// Dismissible via localStorage.

import { useEffect, useState } from 'react';
import Link from 'next/link';

const DISMISS_KEY = 'onboarding_stripe_reminder_dismissed';

interface Props {
  stripeConnected: boolean;
}

export default function OnboardingReminderBanner({ stripeConnected }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (stripeConnected) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, [stripeConnected]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <span>⚠️</span>
        <span>
          Les paiements en ligne sont désactivés.{' '}
          <Link
            href="/espace-restaurateur/stripe"
            className="font-semibold underline hover:text-amber-900"
          >
            Connectez Stripe
          </Link>{' '}
          pour accepter les commandes.
        </span>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-amber-500 hover:text-amber-700 text-lg leading-none"
        aria-label="Fermer"
      >
        ×
      </button>
    </div>
  );
}

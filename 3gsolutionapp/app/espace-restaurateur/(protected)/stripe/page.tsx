'use client';

// TICK-162 — Page admin : statut Stripe Connect + bouton connexion/déconnexion

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

type StripeStatus = {
  connected: boolean;
  accountIdPreview: string | null;
};

export default function AdminStripePage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Feedback depuis la route /return (Accounts v2)
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setSuccess('Votre compte Stripe a été connecté avec succès.');
    } else if (searchParams.get('error') === 'onboarding_incomplete') {
      setError("L'onboarding Stripe n'est pas terminé. Veuillez compléter toutes les étapes requises.");
    } else if (searchParams.get('error') === 'connect_failed') {
      setError('La connexion Stripe a échoué. Veuillez réessayer.');
    } else if (searchParams.get('error') === 'unauthorized') {
      setError('Session expirée. Veuillez vous reconnecter puis réessayer.');
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stripe-status');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatus(data);
    } catch {
      setError('Impossible de charger le statut Stripe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleDisconnect() {
    if (!confirm('Déconnecter votre compte Stripe ? Les paiements en ligne seront désactivés jusqu\'à reconnexion.')) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/connect/disconnect', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Erreur serveur');
      }
      setSuccess('Compte Stripe déconnecté.');
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la déconnexion.');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Paiements Stripe</h1>

      {/* Bannières feedback */}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Carte statut */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 space-y-5">
        {loading ? (
          <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ) : status?.connected ? (
          <>
            {/* Connecté */}
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Compte Stripe connecté</p>
                {status.accountIdPreview && (
                  <p className="text-sm text-gray-500 font-mono mt-0.5">{status.accountIdPreview}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Vos paiements en ligne sont actifs. Les fonds sont versés directement sur votre compte Stripe.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Ouvrir mon dashboard Stripe
                <span className="text-gray-400">↗</span>
              </a>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disconnecting ? 'Déconnexion…' : 'Déconnecter Stripe'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Non connecté */}
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-gray-300 shrink-0" />
              <p className="font-semibold text-gray-900">Aucun compte Stripe connecté</p>
            </div>

            <p className="text-sm text-gray-600">
              Connectez votre compte Stripe pour accepter les paiements en ligne.
              Si vous n&apos;avez pas encore de compte, Stripe vous guidera lors de la connexion.
            </p>

            {/* TICK-175 — POST vers initiate (Accounts v2), pas GET vers connect (OAuth v1) */}
            <form method="post" action="/api/stripe/connect/initiate">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Connecter mon compte Stripe
              </button>
            </form>
          </>
        )}
      </div>

      {/* Aide */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">Comment ça fonctionne ?</p>
        <p>
          En connectant votre compte Stripe, vous autorisez la plateforme à créer des sessions
          de paiement en votre nom. Les fonds sont versés directement sur votre compte Stripe,
          sans intermédiaire.
        </p>
      </div>
    </div>
  );
}

'use client';
// TICK-196 — Step 3 : Stripe Connect dans le wizard onboarding

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StepProps } from '../types';

type StripeStatus = {
  connected: boolean;
  accountIdPreview: string | null;
};

export default function StepStripe({ onNext, onMarkStep, stepId }: StepProps) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Feedback depuis le retour OAuth (?connected=true depuis /api/stripe/connect/return)
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setSuccess('Votre compte Stripe a été connecté avec succès !');
    } else if (searchParams.get('error') === 'onboarding_incomplete') {
      setError("L'onboarding Stripe n'est pas terminé. Veuillez compléter toutes les étapes requises.");
    } else if (searchParams.get('error') === 'connect_failed') {
      setError('La connexion Stripe a échoué. Veuillez réessayer.');
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stripe-status');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatus(data);
      // Marque l'étape si déjà connecté
      if (data.connected) {
        await onMarkStep(stepId);
      }
    } catch {
      setError('Impossible de charger le statut Stripe.');
    } finally {
      setLoading(false);
    }
  }, [onMarkStep, stepId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleConnectSuccess() {
    await onMarkStep(stepId);
    await fetchStatus();
  }

  // Marque auto si connected=true dans l'URL (retour OAuth)
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      handleConnectSuccess();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Activez les paiements en ligne</h2>
        <p className="text-sm text-gray-500 mt-1">
          Connectez votre compte Stripe pour accepter les paiements par carte.
          Si vous n&apos;avez pas encore de compte, Stripe vous guidera lors de la connexion.
        </p>
      </div>

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

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
        {loading ? (
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
        ) : status?.connected ? (
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">Compte Stripe connecté</p>
              {status.accountIdPreview && (
                <p className="text-xs text-gray-500 font-mono mt-0.5">{status.accountIdPreview}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-gray-300 shrink-0" />
              <p className="text-sm text-gray-700">Aucun compte Stripe connecté</p>
            </div>
            {/* TICK-196 — POST vers initiate avec returnTo=onboarding */}
            <form method="post" action="/api/stripe/connect/initiate?returnTo=onboarding">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Connecter mon compte Stripe
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Explication */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700 space-y-1">
        <p className="font-medium">Comment ça fonctionne ?</p>
        <p>
          Les paiements sont effectués directement sur votre compte Stripe.
          Les fonds vous sont versés sans intermédiaire.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {status?.connected && (
          <button
            onClick={onNext}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Continuer →
          </button>
        )}
      </div>
    </div>
  );
}

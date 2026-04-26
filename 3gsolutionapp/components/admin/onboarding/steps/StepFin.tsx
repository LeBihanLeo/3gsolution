'use client';
// TICK-199 — Step final : récapitulatif + accès au dashboard

import { useState } from 'react';
import type { StepProps } from '../types';

const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  personnalisation: { label: 'Personnalisation',  icon: '🎨' },
  menu:             { label: 'Menu',              icon: '🍽' },
  stripe:           { label: 'Paiements Stripe',  icon: '💳' },
  commandes:        { label: 'Commandes',         icon: '📋' },
  '2fa':            { label: 'Sécurité 2FA',      icon: '🔒' },
};

const ALL_STEPS = Object.keys(STEP_LABELS);

export default function StepFin({ onComplete, completedSteps }: StepProps) {
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    setLoading(true);
    await onComplete();
  }

  const skipped = ALL_STEPS.filter((s) => !completedSteps.includes(s));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="text-5xl">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900">Votre restaurant est configuré !</h2>
        <p className="text-sm text-gray-500">
          Vous pouvez maintenant accéder à votre espace administrateur.
        </p>
      </div>

      {/* Récapitulatif */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Récapitulatif</p>
        {ALL_STEPS.map((stepId) => {
          const meta = STEP_LABELS[stepId];
          const done = completedSteps.includes(stepId);
          return (
            <div
              key={stepId}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                done
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <span className="text-lg">{meta.icon}</span>
              <span className={`flex-1 text-sm font-medium ${done ? 'text-green-800' : 'text-orange-700'}`}>
                {meta.label}
              </span>
              <span className={`text-xs font-semibold ${done ? 'text-green-600' : 'text-orange-500'}`}>
                {done ? '✓ Complété' : '⏱ À configurer'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rappel si étapes importantes manquantes */}
      {skipped.includes('stripe') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <strong>Rappel :</strong> Les paiements en ligne sont désactivés tant que Stripe n&apos;est pas connecté.
          Vous pouvez le faire à tout moment depuis <em>Paramètres &gt; Paiements</em>.
        </div>
      )}
      {skipped.includes('2fa') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <strong>Rappel :</strong> Activez le 2FA pour sécuriser l&apos;accès à votre compte depuis <em>Paramètres &gt; Sécurité</em>.
        </div>
      )}

      <button
        onClick={handleFinish}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors"
      >
        {loading ? 'Redirection…' : 'Accéder à mon dashboard →'}
      </button>
    </div>
  );
}

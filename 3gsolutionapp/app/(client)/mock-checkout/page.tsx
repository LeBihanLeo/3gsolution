'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCart } from '@/lib/cartContext';

// ─── Contenu ─────────────────────────────────────────────────────────────────

function MockCheckoutContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const router = useRouter();
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!sessionId) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500">Session invalide.</p>
      </div>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mock-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Erreur lors de la confirmation');
        setLoading(false);
        return;
      }
      clearCart();
      router.push(`/confirmation?session_id=${sessionId}`);
    } catch {
      setError('Erreur réseau. Réessayez.');
      setLoading(false);
    }
  };

  const handleCancel = () => router.push('/commande');

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      {/* Bannière mode dev */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6 text-xs text-amber-700 font-medium text-center">
        MODE DÉVELOPPEMENT — Paiement simulé (Stripe non configuré)
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {/* En-tête façon Stripe */}
        <div className="bg-indigo-600 px-6 py-5">
          <p className="text-white text-xs font-medium uppercase tracking-wider mb-1">
            Paiement sécurisé
          </p>
          <p className="text-white text-sm opacity-80">3G Solution</p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {/* Carte de test simulée */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Numéro de carte
            </label>
            <div className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 font-mono">
              4242 4242 4242 4242
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Expiration
              </label>
              <div className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
                12/30
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CVC</label>
              <div className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
                123
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Confirmation…' : 'Payer (simulé)'}
          </button>

          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-full text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors"
          >
            ← Annuler et revenir à la commande
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Chargement…</div>}>
      <MockCheckoutContent />
    </Suspense>
  );
}

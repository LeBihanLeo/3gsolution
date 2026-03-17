'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cartContext';

function ConfirmationContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const { clearCart } = useCart();

  useEffect(() => {
    if (sessionId) {
      clearCart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">❌</p>
        <p className="text-red-500 text-lg font-medium mb-2">Lien invalide ou expiré</p>
        <p className="text-gray-500 text-sm mb-6">
          Aucun identifiant de commande trouvé.
        </p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Votre commande est confirmée !
      </h1>
      <p className="text-gray-600 mb-1">
        Votre paiement a bien été reçu. Nous préparons votre commande.
      </p>
      <p className="text-xs text-gray-400 font-mono mb-8">
        Réf. {sessionId.slice(0, 24)}…
      </p>

      <Link
        href="/"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        Retour au menu
      </Link>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}

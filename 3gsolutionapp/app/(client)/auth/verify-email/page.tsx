'use client';
// TICK-070 — Page /auth/verify-email
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type State = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState('error');
      setMessage('Token manquant.');
      return;
    }

    fetch('/api/client/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setState('success');
        } else {
          setState('error');
          setMessage(data.error ?? 'Une erreur est survenue.');
        }
      })
      .catch(() => {
        setState('error');
        setMessage('Erreur réseau. Réessayez.');
      });
  }, [searchParams]);

  if (state === 'loading') {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Vérification en cours…</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="py-6">
        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Email vérifié !</h1>
          <p className="text-gray-500 text-sm mb-6">Votre compte est activé. Vous pouvez maintenant vous connecter.</p>
          <Link
            href="/auth/login"
            className="inline-block bg-orange-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-700 transition-colors text-sm"
          >
            Se connecter →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">❌</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Vérification échouée</h1>
        <p className="text-gray-500 text-sm mb-6">{message}</p>
        <Link
          href="/auth/register"
          className="text-orange-600 text-sm font-medium hover:text-orange-700 transition-colors"
        >
          Créer un nouveau compte →
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, FormEvent, Suspense } from 'react';

function ReinitialiserForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value;

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/client/reinitialiser-mdp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/connexion?reset=1');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Lien invalide ou expiré.');
    }
  }

  if (!token) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Lien invalide ou manquant.</p>
        <Link href="/mot-de-passe-oublie" className="text-blue-600 hover:underline">
          Faire une nouvelle demande
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Nouveau mot de passe
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau mot de passe{' '}
              <span className="text-gray-400 font-normal">(8 caractères min.)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p>{error}</p>
              {error.includes('expiré') && (
                <Link href="/mot-de-passe-oublie" className="text-blue-600 hover:underline mt-1 block">
                  Faire une nouvelle demande
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ReinitialiserMdpPage() {
  return (
    <Suspense>
      <ReinitialiserForm />
    </Suspense>
  );
}

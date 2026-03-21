'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, FormEvent, Suspense } from 'react';

function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/mon-compte';
  const registered = searchParams.get('registered') === '1';
  const resetDone = searchParams.get('reset') === '1';

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    const result = await signIn('client-credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Email ou mot de passe incorrect.');
    } else {
      router.push(redirectTo);
    }
  }

  async function handleGoogle() {
    setLoadingGoogle(true);
    await signIn('google', { callbackUrl: redirectTo });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Mon espace
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          La connexion est facultative pour commander.
        </p>

        {registered && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Compte créé ! Connectez-vous ci-dessous.
          </div>
        )}
        {resetDone && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.
          </div>
        )}

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loadingGoogle}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.02a4.78 4.78 0 0 1-7.13-2.5H1.9v2.07A8 8 0 0 0 8.99 17z"/>
            <path fill="#FBBC05" d="M4.55 10.54a4.8 4.8 0 0 1 0-3.08V5.39H1.9A8 8 0 0 0 1 9a8 8 0 0 0 .9 3.61l2.65-2.07z"/>
            <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 0 0 1.9 5.39L4.55 7.46A4.77 4.77 0 0 1 8.98 3.58z"/>
          </svg>
          {loadingGoogle ? 'Redirection…' : 'Continuer avec Google'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <hr className="flex-1 border-gray-200" />
          <span className="text-xs text-gray-400">ou</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        {/* Email + mot de passe */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <Link href="/mot-de-passe-oublie" className="text-xs text-blue-600 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="text-blue-600 hover:underline font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionForm />
    </Suspense>
  );
}

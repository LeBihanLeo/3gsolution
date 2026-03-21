'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, FormEvent } from 'react';

export default function InscriptionPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const nom = (form.elements.namedItem('nom') as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;
    const consentement = (form.elements.namedItem('consentement') as HTMLInputElement).checked;

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!consentement) {
      setError('Vous devez accepter les conditions pour créer un compte.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/client/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, password, consentement }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/connexion?registered=1');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Une erreur est survenue. Veuillez réessayer.');
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Créer un compte</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Suivez vos commandes et bénéficiez d&apos;avantages futurs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom / Nom
            </label>
            <input
              id="nom"
              name="nom"
              type="text"
              required
              autoComplete="name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
              Mot de passe{' '}
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

          {/* Consentement obligatoire */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              name="consentement"
              type="checkbox"
              required
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              J&apos;accepte que mes données soient conservées pour la gestion de mon compte et
              l&apos;historique de mes commandes. Voir les{' '}
              <Link href="/mentions-legales" className="text-blue-600 hover:underline">
                mentions légales
              </Link>
              .
            </span>
          </label>

          {/* Consentement marketing (optionnel) */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              name="consentementMarketing"
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              J&apos;accepte de recevoir des offres et actualités du restaurant. (Optionnel)
            </span>
          </label>

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
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-blue-600 hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

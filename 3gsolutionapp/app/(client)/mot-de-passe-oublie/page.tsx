'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';

export default function MotDePasseOubliePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const email = (
      (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
    ).trim();

    await fetch('/api/client/mot-de-passe-oublie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Mot de passe oublié
        </h1>

        {submitted ? (
          <div className="text-center space-y-4 mt-4">
            <p className="text-sm text-gray-600">
              Si un compte existe avec cette adresse, un email de réinitialisation vous a été
              envoyé. Pensez à vérifier vos spams.
            </p>
            <Link href="/connexion" className="text-sm text-blue-600 hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">
              Saisissez votre email pour recevoir un lien de réinitialisation.
            </p>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>

            <p className="text-sm text-center text-gray-500 mt-4">
              <Link href="/connexion" className="text-blue-600 hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

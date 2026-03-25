'use client';
// TICK-070 — Page /auth/forgot-password
// TICK-088 — BackLink retour connexion
import { useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch('/api/client/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Email envoyé</h1>
          <p className="text-gray-500 text-sm">
            Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation sous peu.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-blue-600 text-sm hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        {/* TICK-088 — Navigation retour */}
        <div className="mb-4">
          <BackLink href="/auth/login" label="Retour à la connexion" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
        <p className="text-gray-500 text-sm mb-6">
          Entrez votre email pour recevoir un lien de réinitialisation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}

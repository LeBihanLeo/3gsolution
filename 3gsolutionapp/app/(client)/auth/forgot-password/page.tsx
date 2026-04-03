'use client';
// TICK-070 — Page /auth/forgot-password
// TICK-088 — BackLink retour connexion
import { useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/ui';
import { TurnstileWidget } from '@/components/TurnstileWidget';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch('/api/client/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken }),
    });

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="py-6">
        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📬</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Email envoyé</h1>
          <p className="text-gray-500 text-sm">
            Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation sous peu.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-orange-600 text-sm font-medium hover:text-orange-700 transition-colors">
            Retour à la connexion →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-5">
          <BackLink href="/auth/login" label="Retour à la connexion" />
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-gray-500 text-sm mt-1">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@exemple.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>
          <TurnstileWidget onToken={setTurnstileToken} />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white rounded-xl py-2.5 font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          <Link href="/auth/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}

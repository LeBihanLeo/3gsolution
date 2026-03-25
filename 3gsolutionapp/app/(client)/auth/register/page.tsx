'use client';
// TICK-070 — Page /auth/register
// TICK-087 — champ nom obligatoire
// TICK-088 — BackLink vers login
import { useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/ui';

function passwordStrength(pwd: string): { label: string; color: string; width: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 2) return { label: 'Faible', color: 'bg-red-500', width: 'w-1/3' };
  if (score <= 3) return { label: 'Moyen', color: 'bg-yellow-500', width: 'w-2/3' };
  return { label: 'Fort', color: 'bg-green-500', width: 'w-full' };
}

export default function RegisterPage() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = password ? passwordStrength(password) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    if (password !== confirm) {
      setErrors({ confirm: ['Les mots de passe ne correspondent pas.'] });
      return;
    }

    setLoading(true);

    const res = await fetch('/api/client/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nom }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
    } else if (res.status === 400 && data.errors) {
      setErrors(data.errors);
    } else {
      setGeneralError(data.error ?? 'Une erreur est survenue.');
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
          <p className="text-gray-500 text-sm">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Ce lien est valable 24 heures.
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

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Créer un compte</h1>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{generalError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              maxLength={50}
              placeholder="Votre prénom ou nom affiché"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.nom?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {strength && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all`} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Force : {strength.label}</p>
              </div>
            )}
            {errors.password?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.confirm?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

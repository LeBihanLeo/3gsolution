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

const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all';

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
      <div className="py-6">
        <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
          <p className="text-gray-500 text-sm">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Ce lien est valable 24 heures.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-orange-600 text-sm hover:text-orange-700 transition-colors font-medium">
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
          <h1 className="text-xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-sm text-gray-500 mt-1">Rejoignez-nous en quelques secondes.</p>
        </div>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{generalError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              maxLength={50}
              placeholder="Votre prénom ou nom affiché"
              className={inputClass}
            />
            {errors.nom?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@exemple.com"
              className={inputClass}
            />
            {errors.email?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
            {strength && (
              <div className="mt-2">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all`} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Force : {strength.label}</p>
              </div>
            )}
            {errors.password?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
            {errors.confirm?.map((e) => <p key={e} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white rounded-xl py-2.5 font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

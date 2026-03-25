'use client';
// TICK-070 — Page /auth/reset-password
// TICK-088 — BackLink retour
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState('');
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

    const res = await fetch('/api/client/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      router.replace('/auth/login?message=password_reset');
    } else if (res.status === 400 && data.errors) {
      setErrors(data.errors);
    } else {
      setGeneralError(data.error ?? 'Une erreur est survenue.');
    }
  }

  if (!token) {
    return (
      <div className="py-6 text-center">
        <p className="text-red-600 text-sm mb-4">Lien invalide ou manquant.</p>
        <Link href="/auth/forgot-password" className="text-orange-600 text-sm font-medium hover:text-orange-700 transition-colors">
          Demander un nouveau lien →
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-5">
          <BackLink href="/auth/forgot-password" label="Retour" />
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Nouveau mot de passe</h1>
          <p className="text-sm text-gray-500 mt-1">Choisissez un mot de passe sécurisé.</p>
        </div>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{generalError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
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
            {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

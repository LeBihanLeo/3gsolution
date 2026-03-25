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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">Lien invalide ou manquant.</p>
          <Link href="/auth/forgot-password" className="text-blue-600 hover:underline text-sm">
            Demander un nouveau lien
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
          <BackLink href="/auth/forgot-password" label="Retour" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nouveau mot de passe</h1>

        {generalError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{generalError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
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
            {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';
// TICK-136 — transmettre le host pour résoudre le tenant admin
// TICK-187 — login deux étapes : password → TOTP si 2FA activé + device trust 30j

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect, useRef } from 'react';
import { TurnstileWidget } from '@/components/TurnstileWidget';

type Step = 'password' | 'totp';

function readDeviceToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)device_trust_admin=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0); // force reset Turnstile entre les étapes

  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'totp') {
      totpInputRef.current?.focus();
    }
  }, [step]);

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const emailVal = (form.elements.namedItem('email') as HTMLInputElement).value;
    const passwordVal = (form.elements.namedItem('password') as HTMLInputElement).value;

    setEmail(emailVal);
    setPassword(passwordVal);

    const deviceToken = readDeviceToken();

    const result = await signIn('credentials', {
      email: emailVal,
      password: passwordVal,
      turnstileToken: turnstileToken ?? '',
      tenantHost: window.location.host,
      deviceToken,
      redirect: false,
    });

    setLoading(false);

    if (!result?.error) {
      router.push('/espace-restaurateur/commandes');
      return;
    }

    if (result.error === 'TOTP_REQUIRED') {
      // Passer à l'étape TOTP — reset Turnstile pour la prochaine soumission
      setTurnstileKey((k) => k + 1);
      setTurnstileToken(null);
      setStep('totp');
      return;
    }

    setError('Email ou mot de passe incorrect.');
  }

  async function handleTotpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      totpCode,
      turnstileToken: turnstileToken ?? '',
      tenantHost: window.location.host,
      redirect: false,
    });

    setLoading(false);

    if (!result?.error) {
      if (rememberDevice) {
        await fetch('/api/admin/2fa/trust-device', { method: 'POST' });
      }
      router.push('/espace-restaurateur/commandes');
      return;
    }

    if (result.error === 'TOTP_INVALID') {
      setError('Code incorrect ou expiré.');
    } else {
      setError('Une erreur est survenue. Veuillez recommencer.');
    }
    setTotpCode('');
    setTurnstileKey((k) => k + 1);
    setTurnstileToken(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">

        {step === 'password' && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Espace restaurateur
            </h1>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </>
        )}

        {step === 'totp' && (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
              Vérification
            </h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Entrez le code à 6 chiffres de votre application d&apos;authentification.
            </p>

            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Code de vérification
                </label>
                <input
                  ref={totpInputRef}
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="000000"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded accent-blue-600"
                />
                Se souvenir de cet appareil pendant 30 jours
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <TurnstileWidget key={turnstileKey} onToken={setTurnstileToken} />

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? 'Vérification…' : 'Valider'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('password'); setError(''); setTotpCode(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Retour
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}

'use client';
// TICK-070 — Page /auth/login
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TurnstileWidget } from '@/components/TurnstileWidget';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // TICK-110 — Rediriger tout utilisateur authentifié (admin → dashboard, sinon → /)
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user && (session.user as { role?: string }).role === 'admin') {
        router.replace('/admin/commandes');
      } else {
        router.replace('/');
      }
    }
  }, [status, session, router]);

  // TICK-111 — Gérer les erreurs OAuth (OAuthAccountNotLinked et génériques)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'OAuthAccountNotLinked') {
      setError('Un compte existe déjà avec cet email. Utilisez email + mot de passe.');
    } else if (errorParam) {
      setError('La connexion Google a échoué. Veuillez utiliser votre email et mot de passe ci-dessous.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('client-credentials', {
      email,
      password,
      rememberMe: String(rememberMe),
      turnstileToken: turnstileToken ?? '',
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === 'EMAIL_NOT_VERIFIED') {
        setError("Votre email n'a pas encore été vérifié. Consultez votre boîte de réception.");
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } else if (result?.ok) {
      router.replace('/');
    }
  }

  async function handleGoogle() {
    setError('');
    await signIn('google', { callbackUrl: '/' });
  }

  if (status === 'loading') return null;

  return (
    <div className="py-6">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Connexion</h1>
          <p className="text-sm text-gray-500 mt-1">Content de vous revoir !</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 px-4 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuer avec Google
        </button>

        <div className="flex items-center my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="mx-3 text-gray-400 text-xs">ou</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Credentials */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded accent-orange-600"
              />
              Se souvenir de moi
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-orange-600 hover:text-orange-700 transition-colors">
              Mot de passe oublié ?
            </Link>
          </div>

          {rememberMe && (
            <p className="text-xs text-gray-400">
              Vos informations resteront mémorisées 30 jours sur cet appareil.
            </p>
          )}

          <TurnstileWidget onToken={setTurnstileToken} />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 text-white rounded-xl py-2.5 font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Pas encore de compte ?{' '}
          <Link href="/auth/register" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Créer un compte
          </Link>
        </p>

        <div className="flex items-center my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="mx-3 text-gray-400 text-xs">ou</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Continuer en tant qu&apos;invité
        </button>
      </div>
    </div>
  );
}

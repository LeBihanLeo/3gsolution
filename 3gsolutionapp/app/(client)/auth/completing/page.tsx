'use client';
// TICK-150 — Page /auth/completing : finalise la session NextAuth après flow cross-domain (Sprint 19)
// Reçoit le RelayToken (t=...) et appelle signIn('cross-domain') pour créer la session locale.
import { useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CompletingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const t = searchParams.get('t');

    if (!t) {
      router.replace('/auth/login?error=invalid');
      return;
    }

    signIn('cross-domain', { t, redirect: false }).then((result) => {
      if (result?.error) {
        router.replace('/auth/login?error=expired');
      } else {
        router.replace('/');
      }
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 text-sm">Connexion en cours…</p>
      </div>
    </div>
  );
}

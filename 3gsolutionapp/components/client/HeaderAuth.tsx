'use client';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';

const HIDE_PROFIL_BTN = ['/profil', '/panier', '/commande'];

export default function HeaderAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (status === 'loading') return null;

  if (session?.user?.role === 'client') {
    if (HIDE_PROFIL_BTN.includes(pathname)) return null;
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push('/profil')}
        aria-label="Mon profil"
      >
        {/* TICK-095 — icône silhouette utilisateur inline SVG */}
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        Mon profil
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push('/auth/login')}
      aria-label="Se connecter"
    >
      Se connecter
    </Button>
  );
}

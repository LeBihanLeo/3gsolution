'use client';
// TICK-116 — Bouton "Mon profil" déplacé du header vers <main> du layout client
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function ProfilButton() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading' || session?.user?.role !== 'client') return null;

  return (
    <div className="absolute top-4 right-4 z-10">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => router.push('/profil')}
        aria-label="Mon profil"
      >
        {/* Icône silhouette utilisateur — TICK-095 */}
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
    </div>
  );
}

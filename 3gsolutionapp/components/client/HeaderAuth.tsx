'use client';
// TICK-116 — Bouton "Mon profil" retiré du header (déplacé dans <main> via ProfilButton)
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function HeaderAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') return null;

  // Clients : aucun bouton dans le header (ProfilButton est dans <main>)
  if (session?.user?.role === 'client') return null;

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

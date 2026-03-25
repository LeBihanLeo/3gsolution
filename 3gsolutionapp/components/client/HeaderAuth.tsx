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

'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Props {
  variant?: 'onImage' | 'onWhite';
}

export default function UserNavButton({ variant = 'onWhite' }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') return <div className="w-9 h-9" aria-hidden />;

  const isClient = session?.user?.role === 'client';
  const href = isClient ? '/profil' : '/auth/login';
  const label = isClient ? 'Mon profil' : 'Se connecter';

  if (variant === 'onImage') {
    return (
      <button
        onClick={() => router.push(href)}
        aria-label={label}
        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push(href)}
      aria-label={label}
      className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#374151"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </button>
  );
}

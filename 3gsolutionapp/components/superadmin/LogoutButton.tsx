'use client';

// TICK-138 — Bouton déconnexion superadmin
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/superadmin/auth', { method: 'DELETE' });
    router.push('/superadmin/login');
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}

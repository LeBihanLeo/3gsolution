'use client';
// TICK-073 — Page /profil
// TICK-077 — Intégration HistoriqueCommandes
// TICK-081 — Export données RGPD
// TICK-088 — BackLink retour vers le menu
// TICK-089 — Section "Mes données" retirée (mise de côté — voir ARCHITECTURE.md > Éléments mis de côté)
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BackLink, Button } from '@/components/ui';
import HistoriqueCommandes from '@/components/client/HistoriqueCommandes';

export default function ProfilPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [nom, setNom] = useState('');
  const [nomLoading, setNomLoading] = useState(false);
  const [nomSuccess, setNomSuccess] = useState('');
  const [nomError, setNomError] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || session.user.role !== 'client') {
    router.replace('/auth/login');
    return null;
  }

  const provider = (session.user as { provider?: string }).provider;

  async function handleUpdateNom(e: React.FormEvent) {
    e.preventDefault();
    setNomError('');
    setNomSuccess('');
    if (!nom.trim()) return;
    setNomLoading(true);

    const res = await fetch('/api/client/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom }),
    });

    setNomLoading(false);

    if (res.ok) {
      setNomSuccess('Nom mis à jour.');
      await update();
    } else {
      const data = await res.json();
      setNomError(data.error ?? 'Erreur lors de la mise à jour.');
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    const res = await fetch('/api/client/account', { method: 'DELETE' });
    if (res.ok) {
      await signOut({ callbackUrl: '/' });
    } else {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-8 space-y-8">

      {/* TICK-088 — Navigation retour */}
      <BackLink href="/" label="Retour vers le menu" />

      {/* ── En-tête ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
            {session.user.email?.includes('google') || provider === 'google' ? 'Google' : 'Email'}
          </span>
        </div>
        <p className="text-sm text-gray-500">{session.user.email}</p>
      </div>

      {/* ── Nom affiché ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Nom affiché</h2>
        <form onSubmit={handleUpdateNom} className="space-y-3">
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={session.user.name ?? 'Votre nom'}
            maxLength={50}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
          {nomError && <p className="text-red-600 text-sm">{nomError}</p>}
          {nomSuccess && <p className="text-green-600 text-sm">{nomSuccess}</p>}
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={nomLoading}
            disabled={nomLoading || !nom.trim()}
          >
            Enregistrer
          </Button>
        </form>
      </div>

      {/* ── Historique commandes (TICK-077) ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Mes commandes</h2>
        <HistoriqueCommandes />
      </div>

      {/* ── Déconnexion ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Se déconnecter
        </Button>
      </div>

      {/* ── Zone danger ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-red-100">
        <h2 className="text-base font-semibold text-red-700 mb-2">Zone danger</h2>
        <p className="text-sm text-gray-500 mb-4">
          La suppression de votre compte est irréversible.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-red-600 text-sm font-medium hover:underline"
        >
          Supprimer mon compte
        </button>
      </div>

      {/* ── Modale confirmation suppression ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer mon compte</h3>
            <p className="text-sm text-gray-500 mb-6">
              Cette action est <strong>irréversible</strong>. Votre compte et vos données seront définitivement supprimés.
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="md"
                className="flex-1"
                onClick={() => setShowDeleteModal(false)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                size="md"
                className="flex-1"
                loading={deleteLoading}
                onClick={handleDeleteAccount}
              >
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

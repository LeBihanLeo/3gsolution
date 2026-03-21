'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface ProduitSnapshot {
  nom: string;
  prix: number;
  quantite: number;
  options: { nom: string; prix: number }[];
}

interface CommandeData {
  _id: string;
  statut: 'payee' | 'prete' | 'en_attente_paiement';
  total: number;
  createdAt: string;
  produits: ProduitSnapshot[];
  retrait: { type: string; creneau?: string };
}

interface ClientData {
  _id: string;
  email: string;
  nom?: string;
  consentementMarketing: boolean;
  provider: string;
}

interface Props {
  client: ClientData;
  commandes: CommandeData[];
}

function formatPrix(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function idCourt(id: string) {
  return id.slice(-6).toUpperCase();
}

const STATUT_LABEL: Record<string, string> = {
  payee: 'En préparation',
  prete: 'Prête',
  en_attente_paiement: 'En attente de paiement',
};

const STATUT_COLOR: Record<string, string> = {
  payee: 'bg-amber-100 text-amber-800',
  prete: 'bg-green-100 text-green-800',
  en_attente_paiement: 'bg-gray-100 text-gray-600',
};

export default function MonCompteClient({ client, commandes }: Props) {
  const [editNom, setEditNom] = useState(false);
  const [nom, setNom] = useState(client.nom ?? '');
  const [marketing, setMarketing] = useState(client.consentementMarketing);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  async function saveProfile() {
    setSaving(true);
    await fetch('/api/client/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, consentementMarketing: marketing }),
    });
    setSaving(false);
    setEditNom(false);
    setSuccessMsg('Profil mis à jour.');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch('/api/client/me', { method: 'DELETE' });
    if (res.ok) {
      await signOut({ callbackUrl: '/' });
    } else {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <div className="space-y-8 py-4">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>

      {successMsg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {successMsg}
        </div>
      )}

      {/* ── Profil ── */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 text-lg">Profil</h2>

        <div>
          <span className="text-sm text-gray-500">Email</span>
          <p className="text-gray-800">{client.email}</p>
          {client.provider === 'google' && (
            <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Compte Google
            </span>
          )}
        </div>

        <div>
          <span className="text-sm text-gray-500">Nom</span>
          {editNom ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveProfile}
                disabled={saving}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditNom(false)} className="text-sm text-gray-500 hover:underline">
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-800">{nom || <span className="text-gray-400">Non renseigné</span>}</p>
              <button onClick={() => setEditNom(true)} className="text-xs text-blue-600 hover:underline">
                Modifier
              </button>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={marketing}
            onChange={async (e) => {
              setMarketing(e.target.checked);
              await fetch('/api/client/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consentementMarketing: e.target.checked }),
              });
            }}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">
            Recevoir les offres et actualités du restaurant
          </span>
        </label>
      </section>

      {/* ── Historique de commandes ── */}
      <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 text-lg">Historique de commandes</h2>

        {commandes.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Vous n&apos;avez pas encore de commandes liées à ce compte.{' '}
            <Link href="/" className="text-blue-600 hover:underline">
              Commander maintenant
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {commandes.map((cmd) => (
              <div key={cmd._id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-gray-700">
                      #{idCourt(cmd._id)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[cmd.statut]}`}
                    >
                      {STATUT_LABEL[cmd.statut]}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatPrix(cmd.total)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{formatDate(cmd.createdAt)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {cmd.produits.map((p) => `${p.quantite}× ${p.nom}`).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Suppression du compte ── */}
      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 text-lg mb-2">Supprimer mon compte</h2>
        <p className="text-sm text-gray-500 mb-4">
          Cette action est irréversible. Vos données personnelles seront supprimées conformément au
          RGPD (Art. 17). Vos commandes seront anonymisées.
        </p>

        {deleteConfirm ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-700">
              Confirmez-vous la suppression définitive de votre compte ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-sm text-red-600 hover:underline"
          >
            Supprimer mon compte
          </button>
        )}
      </section>

      <div className="text-center">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-sm text-gray-500 hover:underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

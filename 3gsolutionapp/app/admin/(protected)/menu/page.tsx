'use client';

// TICK-102 — Vue produits style cartes client avec boutons management

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import ProduitForm, { ProduitData, ProduitFormValues } from '@/components/admin/ProduitForm';

// ─── Types ────────────────────────────────────────────────────────────────────

type Toast = { message: string; type: 'success' | 'error' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

// ─── Modale confirmation suppression ─────────────────────────────────────────

function ModalConfirmation({
  nom,
  onConfirm,
  onCancel,
}: {
  nom: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Supprimer ce produit ?</h3>
        <p className="text-sm text-gray-500 mb-5">
          <span className="font-medium text-gray-800">&ldquo;{nom}&rdquo;</span> sera définitivement supprimé. Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Carte produit admin ──────────────────────────────────────────────────────

function ProduitCard({
  produit,
  onEdit,
  onToggle,
  onDelete,
}: {
  produit: ProduitData;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity flex flex-col h-full ${
        !produit.actif ? 'opacity-60' : ''
      }`}
    >
      {/* Image */}
      {produit.imageUrl ? (
        <div className="relative w-full h-40 bg-gray-100">
          <Image
            src={produit.imageUrl}
            alt={produit.nom}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 300px"
          />
          {!produit.actif && (
            <div className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              Désactivé
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-300 text-4xl">🍽</span>
          {!produit.actif && (
            <span className="absolute text-xs font-semibold bg-gray-800/70 text-white px-2 py-0.5 rounded-full">
              Désactivé
            </span>
          )}
        </div>
      )}

      {/* Infos */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 leading-tight">{produit.nom}</h3>
          <span className="shrink-0 text-base font-bold text-gray-900">{formatPrix(produit.prix)}</span>
        </div>
        <p className="text-xs text-orange-500 font-medium mb-1">{produit.categorie}</p>
        {produit.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{produit.description}</p>
        )}
        {produit.options.length > 0 && (
          <p className="text-xs text-gray-400 mb-3">{produit.options.length} option(s)</p>
        )}

        {/* Boutons management */}
        <div className="flex gap-2 pt-2 border-t border-gray-100 mt-auto">
          <button
            onClick={onEdit}
            className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg py-1.5 transition-colors"
          >
            Modifier
          </button>
          <button
            onClick={onToggle}
            className={`flex-1 text-xs font-medium rounded-lg py-1.5 border transition-colors ${
              produit.actif
                ? 'text-gray-500 border-gray-200 hover:bg-gray-50'
                : 'text-green-600 border-green-200 hover:bg-green-50'
            }`}
          >
            {produit.actif ? 'Désactiver' : 'Activer'}
          </button>
          <button
            onClick={onDelete}
            className="flex-1 text-xs font-medium text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 rounded-lg py-1.5 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMenuPage() {
  const [produits, setProduits] = useState<ProduitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProduitData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProduitData | null>(null);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProduits = useCallback(async () => {
    try {
      const res = await fetch('/api/produits?all=true');
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      setProduits(data.data ?? []);
    } catch {
      showToast('Impossible de charger les produits', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProduits();
  }, [fetchProduits]);

  // ── Créer ──────────────────────────────────────────────────────────────────

  const handleCreate = async (values: ProduitFormValues) => {
    const body = { ...values, imageUrl: values.imageUrl || undefined };
    const res = await fetch('/api/produits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast('Erreur lors de la création', 'error');
      return;
    }
    setProduits((prev) => [json.data, ...prev]);
    setCreating(false);
    showToast('Produit créé avec succès');
  };

  // ── Modifier ───────────────────────────────────────────────────────────────

  const handleUpdate = async (values: ProduitFormValues) => {
    if (!editing) return;
    const res = await fetch(`/api/produits/${editing._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast('Erreur lors de la mise à jour', 'error');
      return;
    }
    setProduits((prev) => prev.map((p) => (p._id === editing._id ? json.data : p)));
    setEditing(null);
    showToast('Produit mis à jour');
  };

  // ── Toggle actif ───────────────────────────────────────────────────────────

  const toggleActif = async (produit: ProduitData) => {
    const res = await fetch(`/api/produits/${produit._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !produit.actif }),
    });
    if (!res.ok) {
      showToast('Erreur lors du changement de statut', 'error');
      return;
    }
    setProduits((prev) =>
      prev.map((p) => (p._id === produit._id ? { ...p, actif: !produit.actif } : p))
    );
  };

  // ── Supprimer ──────────────────────────────────────────────────────────────

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/produits/${confirmDelete._id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    if (!res.ok) {
      showToast('Erreur lors de la suppression', 'error');
      return;
    }
    setProduits((prev) => prev.filter((p) => p._id !== confirmDelete._id));
    showToast('Produit supprimé');
  };

  // Groupement par catégorie
  const categories = Array.from(new Set(produits.map((p) => p.categorie)));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Modale suppression */}
      {confirmDelete && (
        <ModalConfirmation
          nom={confirmDelete.nom}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
        {!creating && (
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nouveau produit
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {creating && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Nouveau produit</h2>
          <ProduitForm
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {/* Formulaire d'édition (panneau plein) */}
      {editing && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Modifier — {editing.nom}
          </h2>
          <ProduitForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && produits.length === 0 && (
        <p className="text-gray-400 text-center py-16">
          Aucun produit. Créez le premier !
        </p>
      )}

      {/* Grille par catégorie */}
      {!loading && produits.length > 0 && (
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {cat}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {produits
                  .filter((p) => p.categorie === cat)
                  .map((p) => (
                    <ProduitCard
                      key={p._id}
                      produit={p}
                      onEdit={() => { setEditing(p); setCreating(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      onToggle={() => toggleActif(p)}
                      onDelete={() => setConfirmDelete(p)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

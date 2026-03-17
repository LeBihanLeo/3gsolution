'use client';

import { useEffect, useState, useCallback } from 'react';
import ProduitForm, { ProduitData, ProduitFormValues } from '@/components/admin/ProduitForm';

// ─── Types ────────────────────────────────────────────────────────────────────

type Toast = { message: string; type: 'success' | 'error' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminMenuPage() {
  const [produits, setProduits] = useState<ProduitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<ProduitData | null>(null);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProduits = useCallback(async () => {
    try {
      // L'admin veut TOUS les produits (actifs + inactifs)
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
    const res = await fetch('/api/produits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast('Erreur lors de la création', 'error');
      return;
    }
    setProduits((prev) => [json.data, ...prev]);
    setMode('list');
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
    setMode('list');
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

  const handleDelete = async (produit: ProduitData) => {
    if (!confirm(`Supprimer "${produit.nom}" ? Cette action est irréversible.`)) return;
    const res = await fetch(`/api/produits/${produit._id}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Erreur lors de la suppression', 'error');
      return;
    }
    setProduits((prev) => prev.filter((p) => p._id !== produit._id));
    showToast('Produit supprimé');
  };

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

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
        {mode === 'list' && (
          <button
            onClick={() => setMode('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nouveau produit
          </button>
        )}
      </div>

      {/* Formulaire (création / édition) */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {mode === 'create' ? 'Nouveau produit' : `Modifier "${editing?.nom}"`}
          </h2>
          <ProduitForm
            initial={mode === 'edit' ? editing ?? undefined : undefined}
            onSubmit={mode === 'create' ? handleCreate : handleUpdate}
            onCancel={() => {
              setMode('list');
              setEditing(null);
            }}
          />
        </div>
      )}

      {/* Liste */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && produits.length === 0 && mode === 'list' && (
        <p className="text-gray-400 text-center py-16">
          Aucun produit. Créez le premier !
        </p>
      )}

      {!loading && produits.length > 0 && (
        <div className="space-y-2">
          {produits.map((p) => (
            <div
              key={p._id}
              className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3 transition-opacity ${
                !p.actif ? 'opacity-50' : ''
              }`}
            >
              {/* Badge statut */}
              <span
                className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  p.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.actif ? 'Actif' : 'Inactif'}
              </span>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.nom}</p>
                <p className="text-xs text-gray-500 truncate">
                  {p.categorie} · {formatPrix(p.prix)}
                  {p.options.length > 0 && ` · ${p.options.length} option(s)`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditing(p);
                    setMode('edit');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Modifier
                </button>
                <button
                  onClick={() => toggleActif(p)}
                  className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
                >
                  {p.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

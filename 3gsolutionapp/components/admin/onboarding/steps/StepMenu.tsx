'use client';
// TICK-195 — Step 2 : Menu — ajouter les premiers produits

import { useState, useCallback } from 'react';
import DropZone from '@/components/admin/DropZone';
import type { StepProps } from '../types';

interface ProduitAdded {
  nom: string;
  categorie: string;
  prix: number; // centimes
}

interface FormData {
  nom: string;
  description: string;
  categorie: string;
  prix: string; // euros (string pour l'input)
  image: string; // URL Vercel Blob après upload
}

const DEFAULT_FORM: FormData = {
  nom: '',
  description: '',
  categorie: 'Plats',
  prix: '',
  image: '',
};

const CATEGORIES = ['Entrées', 'Plats', 'Desserts', 'Boissons', 'Formules'];

function formatPrix(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function StepMenu({ onNext, onMarkStep, stepId }: StepProps) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [added, setAdded] = useState<ProduitAdded[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function validate(): string | null {
    if (!form.nom.trim()) return 'Le nom est requis.';
    if (!form.description.trim()) return 'La description est requise.';
    const prixNum = parseFloat(form.prix.replace(',', '.'));
    if (isNaN(prixNum) || prixNum <= 0) return 'Le prix doit être un nombre positif.';
    return null;
  }

  const handleAdd = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);
    try {
      const prixCentimes = Math.round(parseFloat(form.prix.replace(',', '.')) * 100);
      const res = await fetch('/api/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(),
          description: form.description.trim(),
          categorie: form.categorie,
          prix: prixCentimes,
          taux_tva: 10,
          options: [],
          actif: true,
          ...(form.image ? { image: form.image } : {}),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Erreur lors de la création.');
        return;
      }
      setAdded((prev) => [...prev, { nom: form.nom.trim(), categorie: form.categorie, prix: prixCentimes }]);
      setForm(DEFAULT_FORM);
      // Marque l'étape dès le premier produit ajouté
      await onMarkStep(stepId);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }, [form, onMarkStep, stepId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Créez votre menu</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ajoutez au moins un produit pour que vos clients puissent commander.
        </p>
      </div>

      {/* Liste des produits ajoutés */}
      {added.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {added.length} produit(s) ajouté(s)
          </p>
          {added.map((p, i) => (
            <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-green-600 text-sm">✓</span>
              <span className="text-sm font-medium text-gray-900">{p.nom}</span>
              <span className="text-xs text-gray-500">{p.categorie}</span>
              <span className="ml-auto text-sm font-semibold text-gray-700">{formatPrix(p.prix)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div className="space-y-4 border border-gray-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700">
          {added.length === 0 ? 'Premier produit' : 'Ajouter un autre produit'}
        </p>

        {/* Photo du produit */}
        <DropZone
          currentImageUrl={form.image || undefined}
          onUploadSuccess={(url) => set('image', url)}
          onRemove={() => set('image', '')}
          label="Photo du produit (optionnel)"
          aspectRatio="square"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
              placeholder="Ex : Burger Classic"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex : Pain brioche, steak haché, cheddar…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
            <select
              value={form.categorie}
              onChange={(e) => set('categorie', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Prix (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={form.prix}
              onChange={(e) => set('prix', e.target.value)}
              placeholder="8,50"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
        >
          {saving ? 'Ajout…' : '+ Ajouter ce produit'}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {added.length > 0 && (
          <button
            onClick={onNext}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Continuer →
          </button>
        )}
      </div>
    </div>
  );
}

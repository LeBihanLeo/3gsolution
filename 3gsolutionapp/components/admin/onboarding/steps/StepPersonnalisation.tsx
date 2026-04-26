'use client';
// TICK-194 — Step 1 : Personnalisation du restaurant
// Form allégé réutilisant les composants existants.

import { useState, useEffect } from 'react';
import DropZone from '@/components/admin/DropZone';
import type { StepProps } from '../types';

interface FormData {
  nomRestaurant: string;
  banniereUrl: string;
  horaireOuverture: string;
  horaireFermeture: string;
  couleurPrincipale: string;
}

const DEFAULT: FormData = {
  nomRestaurant: '',
  banniereUrl: '',
  horaireOuverture: '11:30',
  horaireFermeture: '14:00',
  couleurPrincipale: '#E63946',
};

export default function StepPersonnalisation({ onNext, onMarkStep, stepId }: StepProps) {
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Charge la config existante
  useEffect(() => {
    fetch('/api/site-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setForm({
            nomRestaurant: data.nomRestaurant ?? DEFAULT.nomRestaurant,
            banniereUrl: data.banniereUrl ?? '',
            horaireOuverture: data.horaireOuverture ?? DEFAULT.horaireOuverture,
            horaireFermeture: data.horaireFermeture ?? DEFAULT.horaireFermeture,
            couleurPrincipale: data.couleurPrincipale ?? DEFAULT.couleurPrincipale,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  function set(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function validate(): string | null {
    if (!form.nomRestaurant.trim()) return 'Le nom du restaurant est requis.';
    if (form.nomRestaurant.length > 80) return 'Le nom ne doit pas dépasser 80 caractères.';
    if (!form.horaireOuverture || !form.horaireFermeture) return 'Les horaires sont requis.';
    if (form.horaireFermeture <= form.horaireOuverture) {
      return "L'heure de fermeture doit être après l'heure d'ouverture.";
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomRestaurant: form.nomRestaurant,
          banniereUrl: form.banniereUrl || undefined,
          horaireOuverture: form.horaireOuverture,
          horaireFermeture: form.horaireFermeture,
          couleurPrincipale: form.couleurPrincipale,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Erreur lors de la sauvegarde.');
        return;
      }
      await onMarkStep(stepId);
      onNext();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex items-center justify-center min-h-64">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Personnalisez votre vitrine</h2>
        <p className="text-sm text-gray-500 mt-1">Ces informations s&apos;affichent sur votre page de commande.</p>
      </div>

      {/* Nom du restaurant */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Nom du restaurant <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.nomRestaurant}
          onChange={(e) => set('nomRestaurant', e.target.value)}
          maxLength={80}
          placeholder="Ex : Le Soleil Doré"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Bannière */}
      <DropZone
        label="Bannière du site"
        aspectRatio="banner"
        currentImageUrl={form.banniereUrl || undefined}
        onUploadSuccess={(url) => set('banniereUrl', url)}
        onRemove={() => set('banniereUrl', '')}
      />

      {/* Couleur principale */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Couleur principale
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.couleurPrincipale}
            onChange={(e) => set('couleurPrincipale', e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-gray-200 p-0.5"
          />
          <input
            type="text"
            value={form.couleurPrincipale}
            onChange={(e) => set('couleurPrincipale', e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            maxLength={7}
            className="w-28 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div
            className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm shrink-0"
            style={{ backgroundColor: form.couleurPrincipale }}
          />
        </div>
      </div>

      {/* Horaires */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Horaires d&apos;ouverture <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ouverture</label>
            <input
              type="time"
              value={form.horaireOuverture}
              onChange={(e) => set('horaireOuverture', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fermeture</label>
            <input
              type="time"
              value={form.horaireFermeture}
              onChange={(e) => set('horaireFermeture', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {form.horaireFermeture && form.horaireOuverture && form.horaireFermeture <= form.horaireOuverture && (
          <p className="text-xs text-red-500 mt-1">L&apos;heure de fermeture doit être après l&apos;heure d&apos;ouverture.</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        {saving ? 'Enregistrement…' : 'Enregistrer et continuer →'}
      </button>
    </div>
  );
}

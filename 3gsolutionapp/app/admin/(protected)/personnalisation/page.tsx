'use client';

// TICK-039 — Bannière via DropZone (remplace le champ URL)
// TICK-100 — Horaires d'ouverture
// TICK-118 — Layout side-by-side formulaire | aperçu
// TICK-122 — Sélecteur couleur principale + aperçu palette
import { useEffect, useState } from 'react';
import PersonnalisationApercu from '@/components/admin/PersonnalisationApercu';
import DropZone from '@/components/admin/DropZone';
import { generatePalette, SitePalette } from '@/lib/palette';

interface FormData {
  nomRestaurant: string;
  banniereUrl: string;
  horaireOuverture: string;
  horaireFermeture: string;
  couleurPrincipale: string;
}

const DEFAULT: FormData = {
  nomRestaurant: 'Mon Restaurant',
  banniereUrl: '',
  horaireOuverture: '11:30',
  horaireFermeture: '14:00',
  couleurPrincipale: '#E63946',
};

export default function PersonnalisationPage() {
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [palette, setPalette] = useState<SitePalette>(() => generatePalette(DEFAULT.couleurPrincipale));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/site-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          const couleur = data.couleurPrincipale ?? DEFAULT.couleurPrincipale;
          setForm({
            nomRestaurant: data.nomRestaurant ?? DEFAULT.nomRestaurant,
            banniereUrl: data.banniereUrl ?? '',
            horaireOuverture: data.horaireOuverture ?? DEFAULT.horaireOuverture,
            horaireFermeture: data.horaireFermeture ?? DEFAULT.horaireFermeture,
            couleurPrincipale: couleur,
          });
          setPalette(generatePalette(couleur));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'couleurPrincipale' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        setPalette(generatePalette(value));
      }
      return next;
    });
    setMessage(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSaving(true);
    setMessage(null);
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
      if (res.ok) {
        setMessage({ type: 'success', text: 'Modifications enregistrées.' });
      } else {
        const { error } = await res.json();
        setMessage({ type: 'error', text: typeof error === 'string' ? error : 'Erreur lors de la sauvegarde.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Chargement…
      </div>
    );
  }

  return (
    // TICK-118 — layout side-by-side sur tablette/desktop
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Personnalisation de la vitrine</h1>

      <div className="flex flex-col md:flex-row gap-6 items-start">
      {/* Colonne gauche : formulaire */}
      <div className="flex-1 min-w-0">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">

        {/* Nom du restaurant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom du restaurant <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.nomRestaurant}
            onChange={(e) => set('nomRestaurant', e.target.value)}
            maxLength={80}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">{form.nomRestaurant.length}/80</p>
        </div>

        {/* Bannière via DropZone — TICK-039 */}
        <DropZone
          label="Bannière du site"
          aspectRatio="banner"
          currentImageUrl={form.banniereUrl || undefined}
          onUploadSuccess={(url) => set('banniereUrl', url)}
          onRemove={() => set('banniereUrl', '')}
        />

        {/* Couleur principale — TICK-122 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Couleur principale du site
          </label>
          <div className="flex items-center gap-3 mb-3">
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
          </div>
          {/* Swatches palette */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['primary', 'Principale'],
                ['primaryLight', 'Claire'],
                ['primaryDark', 'Foncée'],
                ['primaryForeground', 'Texte'],
                ['surface', 'Surface'],
                ['border', 'Bordure'],
              ] as [keyof SitePalette, string][]
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-lg border border-gray-200 shadow-sm"
                  style={{ backgroundColor: palette[key] }}
                  title={`${label}: ${palette[key]}`}
                />
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Horaires d'ouverture — TICK-100 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Horaires d&apos;ouverture</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ouverture <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.horaireOuverture}
                onChange={(e) => set('horaireOuverture', e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fermeture <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.horaireFermeture}
                onChange={(e) => set('horaireFermeture', e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {form.horaireFermeture && form.horaireOuverture && form.horaireFermeture <= form.horaireOuverture && (
            <p className="text-xs text-red-500 mt-1">
              L&apos;heure de fermeture doit être après l&apos;heure d&apos;ouverture.
            </p>
          )}
        </div>

        {/* Message feedback */}
        {message && (
          <p
            className={`text-sm px-3 py-2 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
      </div>

      {/* Colonne droite : aperçu en temps réel */}
      <div className="md:w-80 lg:w-96 shrink-0 md:sticky md:top-6">
        <h2 className="text-sm font-medium text-gray-600 mb-3 uppercase tracking-wide">
          Aperçu en temps réel
        </h2>
        <div className="overflow-y-auto max-h-[80vh]">
          <PersonnalisationApercu
            nomRestaurant={form.nomRestaurant}
            banniereUrl={form.banniereUrl}
          />
        </div>
      </div>
      </div>
    </div>
  );
}

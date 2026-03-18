'use client';

import { useEffect, useState } from 'react';
import PersonnalisationApercu from '@/components/admin/PersonnalisationApercu';

interface FormData {
  nomRestaurant: string;
  banniereUrl: string;
}

const DEFAULT: FormData = {
  nomRestaurant: 'Mon Restaurant',
  banniereUrl: '',
};

export default function PersonnalisationPage() {
  const [form, setForm] = useState<FormData>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setForm({
            nomRestaurant: data.nomRestaurant ?? DEFAULT.nomRestaurant,
            banniereUrl: data.banniereUrl ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function validate(): string | null {
    if (!form.nomRestaurant.trim()) return 'Le nom du restaurant est requis.';
    if (form.nomRestaurant.length > 80) return 'Le nom ne doit pas dépasser 80 caractères.';
    if (form.banniereUrl && !/^https?:\/\//.test(form.banniereUrl) && !form.banniereUrl.startsWith('/')) {
      return "L'URL de la bannière doit être HTTPS ou un chemin relatif (/...).";
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
          ...form,
          banniereUrl: form.banniereUrl || undefined,
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
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Personnalisation de la vitrine</h1>

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

        {/* URL de la bannière */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL de la bannière <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="url"
            value={form.banniereUrl}
            onChange={(e) => set('banniereUrl', e.target.value)}
            placeholder="https://exemple.com/banniere.jpg  ou  /images/banniere.jpg"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

      {/* Aperçu en temps réel */}
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-3 uppercase tracking-wide">
          Aperçu en temps réel
        </h2>
        <PersonnalisationApercu
          nomRestaurant={form.nomRestaurant}
          banniereUrl={form.banniereUrl}
        />
      </div>
    </div>
  );
}

'use client';

// TICK-138 — Formulaire création restaurant
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function NouveauRestaurantPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const getValue = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement)?.value ?? '';

    const domainesAlternatifs = getValue('domainesAlternatifs')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    const body = {
      nomRestaurant: getValue('nomRestaurant'),
      slug: getValue('slug'),
      domaine: getValue('domaine'),
      domainesAlternatifs,
      adminEmail: getValue('adminEmail'),
      adminPassword: getValue('adminPassword'),
      stripeSecretKey: getValue('stripeSecretKey'),
      stripePublishableKey: getValue('stripePublishableKey'),
      stripeWebhookSecret: getValue('stripeWebhookSecret'),
      horaireOuverture: getValue('horaireOuverture') || '11:30',
      horaireFermeture: getValue('horaireFermeture') || '14:00',
      couleurPrincipale: getValue('couleurPrincipale') || '#E63946',
    };

    try {
      const res = await fetch('/api/superadmin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Erreur lors de la création.');
        return;
      }

      router.push('/superadmin');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/superadmin" className="text-gray-500 hover:text-gray-900 text-sm">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau restaurant</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Identité</h2>

          <Field label="Nom du restaurant" name="nomRestaurant" required
            onChange={(v) => setSlug(slugify(v))} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-red-400">*</span>
            </label>
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mon-restaurant"
              pattern="^[a-z0-9-]+$"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minuscules, chiffres et tirets uniquement.</p>
          </div>

          <Field label="Domaine principal" name="domaine" required placeholder="www.monresto.com" />
          <Field label="Domaines alternatifs" name="domainesAlternatifs" placeholder="monresto.com, monresto.fr (séparés par virgule)" />
          <Field label="Couleur principale" name="couleurPrincipale" type="color" defaultValue="#E63946" />
        </section>

        {/* Horaires */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Horaires</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ouverture" name="horaireOuverture" defaultValue="11:30" pattern="\d{2}:\d{2}" />
            <Field label="Fermeture" name="horaireFermeture" defaultValue="14:00" pattern="\d{2}:\d{2}" />
          </div>
        </section>

        {/* Compte admin */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Compte admin</h2>
          <Field label="Email admin" name="adminEmail" type="email" required />
          <Field label="Mot de passe admin" name="adminPassword" type="password" required placeholder="8 caractères minimum" />
        </section>

        {/* Stripe */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Stripe</h2>
          <Field label="Clé secrète (sk_live_... ou sk_test_...)" name="stripeSecretKey" required placeholder="sk_live_..." />
          <Field label="Clé publique (pk_live_... ou pk_test_...)" name="stripePublishableKey" required placeholder="pk_live_..." />
          <Field label="Secret webhook (whsec_...)" name="stripeWebhookSecret" required placeholder="whsec_..." />
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Création…' : 'Créer le restaurant'}
          </button>
          <Link
            href="/superadmin"
            className="text-gray-500 hover:text-gray-900 px-4 py-2 text-sm"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}

// ── Composant champ réutilisable ──────────────────────────────────────────────
function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  defaultValue,
  pattern,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  pattern?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        pattern={pattern}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
      />
    </div>
  );
}

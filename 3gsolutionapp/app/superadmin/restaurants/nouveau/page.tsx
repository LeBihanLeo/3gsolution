'use client';

// TICK-138 — Page création restaurant (super-admin)
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NouveauRestaurantPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const getValue = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const body = {
      nom: getValue('nom'),
      domaine: getValue('domaine'),
      slug: getValue('slug'),
      adminEmail: getValue('adminEmail'),
      adminPassword: getValue('adminPassword'),
      stripePublishableKey: getValue('stripePublishableKey') || undefined,
      stripeSecretKey: getValue('stripeSecretKey') || undefined,
      stripeWebhookSecret: getValue('stripeWebhookSecret') || undefined,
      couleurPrimaire: getValue('couleurPrimaire') || '#E63946',
    };

    const res = await fetch('/api/superadmin/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data?.error ?? 'Erreur lors de la création');
      return;
    }

    router.push('/superadmin/restaurants');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-6 block">
          ← Retour
        </button>
        <h1 className="text-2xl font-bold mb-8">Nouveau restaurant</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Nom du restaurant" name="nom" required />
          <Field label="Domaine (ex: resto-a.com)" name="domaine" required placeholder="resto-a.com" />
          <Field label="Slug (ex: resto-a)" name="slug" required placeholder="resto-a" />
          <hr className="border-gray-700" />
          <Field label="Email admin" name="adminEmail" type="email" required />
          <Field label="Mot de passe admin" name="adminPassword" type="password" required />
          <hr className="border-gray-700" />
          <Field label="Stripe publishable key" name="stripePublishableKey" placeholder="pk_live_…" />
          <Field label="Stripe secret key" name="stripeSecretKey" type="password" placeholder="sk_live_…" />
          <Field label="Stripe webhook secret" name="stripeWebhookSecret" type="password" placeholder="whsec_…" />
          <hr className="border-gray-700" />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Couleur primaire</label>
            <input
              name="couleurPrimaire"
              type="color"
              defaultValue="#E63946"
              className="h-10 w-20 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-gray-900 font-medium py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? 'Création…' : 'Créer le restaurant'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, name, type = 'text', required = false, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white placeholder-gray-500"
      />
    </div>
  );
}

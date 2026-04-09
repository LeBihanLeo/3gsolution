'use client';

// TICK-138 — Page édition restaurant (super-admin)
import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface RestaurantDetail {
  _id: string;
  nom: string;
  domaine: string;
  slug: string;
  adminEmail: string;
  couleurPrimaire: string;
  couleurSecondaire: string;
  horaireOuverture: string;
  horaireFermeture: string;
  stripePublishableKey?: string;
}

export default function EditRestaurantPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/superadmin/restaurants/${id}`)
      .then((r) => r.json())
      .then((data) => setRestaurant(data.data))
      .catch(() => setError('Erreur de chargement'));
  }, [id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    const form = e.currentTarget;
    const getValue = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;

    const body: Record<string, unknown> = {
      nom: getValue('nom'),
      domaine: getValue('domaine'),
      slug: getValue('slug'),
      adminEmail: getValue('adminEmail'),
      couleurPrimaire: getValue('couleurPrimaire'),
      horaireOuverture: getValue('horaireOuverture'),
      horaireFermeture: getValue('horaireFermeture'),
    };

    const adminPassword = getValue('adminPassword');
    if (adminPassword) body.adminPassword = adminPassword;

    const stripeSecret = getValue('stripeSecretKey');
    if (stripeSecret) body.stripeSecretKey = stripeSecret;

    const stripeWebhook = getValue('stripeWebhookSecret');
    if (stripeWebhook) body.stripeWebhookSecret = stripeWebhook;

    const stripePub = getValue('stripePublishableKey');
    if (stripePub) body.stripePublishableKey = stripePub;

    const res = await fetch(`/api/superadmin/restaurants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data?.error ?? 'Erreur lors de la mise à jour');
    } else {
      setSuccess('Restaurant mis à jour.');
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le restaurant "${restaurant?.nom}" ? Cette action est irréversible.`)) return;
    const res = await fetch(`/api/superadmin/restaurants/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/superadmin/restaurants');
    else setError('Erreur lors de la suppression');
  }

  if (!restaurant) return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      {error ? <p className="text-red-400">{error}</p> : <p className="text-gray-400">Chargement…</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-6 block">
          ← Retour
        </button>
        <h1 className="text-2xl font-bold mb-8">Modifier : {restaurant.nom}</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Nom du restaurant" name="nom" defaultValue={restaurant.nom} required />
          <Field label="Domaine" name="domaine" defaultValue={restaurant.domaine} required />
          <Field label="Slug" name="slug" defaultValue={restaurant.slug} required />
          <hr className="border-gray-700" />
          <Field label="Email admin" name="adminEmail" type="email" defaultValue={restaurant.adminEmail} required />
          <Field label="Nouveau mot de passe admin (laisser vide = inchangé)" name="adminPassword" type="password" />
          <hr className="border-gray-700" />
          <Field label="Stripe publishable key" name="stripePublishableKey" defaultValue={restaurant.stripePublishableKey ?? ''} />
          <Field label="Stripe secret key (laisser vide = inchangé)" name="stripeSecretKey" type="password" />
          <Field label="Stripe webhook secret (laisser vide = inchangé)" name="stripeWebhookSecret" type="password" />
          <hr className="border-gray-700" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Heure ouverture" name="horaireOuverture" defaultValue={restaurant.horaireOuverture} placeholder="11:30" />
            <Field label="Heure fermeture" name="horaireFermeture" defaultValue={restaurant.horaireFermeture} placeholder="14:00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Couleur primaire</label>
            <input
              name="couleurPrimaire"
              type="color"
              defaultValue={restaurant.couleurPrimaire}
              className="h-10 w-20 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-400 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-gray-900 font-medium py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>

        <hr className="border-gray-700 my-8" />
        <button
          onClick={handleDelete}
          className="w-full bg-red-900 hover:bg-red-800 text-white font-medium py-2 rounded-lg transition-colors"
        >
          Supprimer ce restaurant
        </button>
      </div>
    </div>
  );
}

function Field({
  label, name, type = 'text', required = false, placeholder, defaultValue,
}: {
  label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white placeholder-gray-500"
      />
    </div>
  );
}

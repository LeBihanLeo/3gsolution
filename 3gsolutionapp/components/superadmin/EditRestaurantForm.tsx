'use client';

// TICK-138 — Formulaire édition restaurant
// Les clés Stripe secrètes sont masquées (jamais retournées par l'API)
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RestaurantData {
  _id: string;
  nomRestaurant: string;
  slug: string;
  domaine: string;
  domainesAlternatifs?: string[];
  adminEmail: string;
  stripePublishableKey: string;
  horaireOuverture: string;
  horaireFermeture: string;
  couleurPrincipale: string;
  fermeeAujourdhui: boolean;
  emailFrom?: string;
}

export default function EditRestaurantForm({ restaurant }: { restaurant: RestaurantData }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

    // Construire le body : n'inclure adminPassword que s'il est renseigné
    const body: Record<string, unknown> = {
      nomRestaurant: getValue('nomRestaurant'),
      slug: getValue('slug'),
      domaine: getValue('domaine'),
      domainesAlternatifs,
      adminEmail: getValue('adminEmail'),
      horaireOuverture: getValue('horaireOuverture'),
      horaireFermeture: getValue('horaireFermeture'),
      couleurPrincipale: getValue('couleurPrincipale'),
    };

    const adminPassword = getValue('adminPassword');
    if (adminPassword) body.adminPassword = adminPassword;

    const stripeSecretKey = getValue('stripeSecretKey');
    if (stripeSecretKey) body.stripeSecretKey = stripeSecretKey;

    const stripePublishableKey = getValue('stripePublishableKey');
    if (stripePublishableKey) body.stripePublishableKey = stripePublishableKey;

    const stripeWebhookSecret = getValue('stripeWebhookSecret');
    if (stripeWebhookSecret) body.stripeWebhookSecret = stripeWebhookSecret;

    const emailFrom = getValue('emailFrom');
    if (emailFrom) body.emailFrom = emailFrom;

    try {
      const res = await fetch(`/api/superadmin/restaurants/${restaurant._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Erreur lors de la mise à jour.');
        return;
      }

      router.push('/superadmin');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/superadmin/restaurants/${restaurant._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Erreur lors de la suppression.');
        setConfirmDelete(false);
        return;
      }

      router.push('/superadmin');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/superadmin" className="text-gray-500 hover:text-gray-900 text-sm">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{restaurant.nomRestaurant}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Identité</h2>
          <Field label="Nom du restaurant" name="nomRestaurant" required defaultValue={restaurant.nomRestaurant} />
          <Field label="Slug" name="slug" required defaultValue={restaurant.slug} pattern="^[a-z0-9-]+$" />
          <Field label="Domaine principal" name="domaine" required defaultValue={restaurant.domaine} />
          <Field
            label="Domaines alternatifs"
            name="domainesAlternatifs"
            defaultValue={(restaurant.domainesAlternatifs ?? []).join(', ')}
            placeholder="monresto.com, monresto.fr"
          />
          <Field label="Couleur principale" name="couleurPrincipale" type="color" defaultValue={restaurant.couleurPrincipale} />
        </section>

        {/* Horaires */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Horaires</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ouverture" name="horaireOuverture" defaultValue={restaurant.horaireOuverture} pattern="\d{2}:\d{2}" />
            <Field label="Fermeture" name="horaireFermeture" defaultValue={restaurant.horaireFermeture} pattern="\d{2}:\d{2}" />
          </div>
        </section>

        {/* Compte admin */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Compte admin</h2>
          <Field label="Email admin" name="adminEmail" type="email" required defaultValue={restaurant.adminEmail} />
          <Field
            label="Nouveau mot de passe admin"
            name="adminPassword"
            type="password"
            placeholder="Laisser vide pour ne pas changer"
          />
        </section>

        {/* Stripe — clés secrètes masquées */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Stripe</h2>
          <p className="text-xs text-gray-500">
            Les clés secrètes ne sont jamais affichées. Remplissez uniquement pour les modifier.
          </p>
          <Field label="Clé publique" name="stripePublishableKey" defaultValue={restaurant.stripePublishableKey} />
          <Field label="Nouvelle clé secrète" name="stripeSecretKey" placeholder="sk_live_**** (laisser vide pour ne pas changer)" />
          <Field label="Nouveau secret webhook" name="stripeWebhookSecret" placeholder="whsec_**** (laisser vide pour ne pas changer)" />
        </section>

        {/* Email expéditeur optionnel */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Email</h2>
          <Field label="Email expéditeur (optionnel)" name="emailFrom" type="email" defaultValue={restaurant.emailFrom ?? ''} placeholder="commandes@monresto.com" />
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <Link href="/superadmin" className="text-gray-500 hover:text-gray-900 px-4 py-2 text-sm">
              Annuler
            </Link>
          </div>

          {/* Zone suppression */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Supprimer ce restaurant
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <span className="text-sm text-red-700">Confirmer la suppression ?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  defaultValue,
  pattern,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  pattern?: string;
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
        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
      />
    </div>
  );
}

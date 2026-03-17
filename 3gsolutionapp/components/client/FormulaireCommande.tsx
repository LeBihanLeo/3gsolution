'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useCart, CartItem } from '@/lib/cartContext';

// ─── Validation ─────────────────────────────────────────────────────────────

const formSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  telephone: z
    .string()
    .regex(
      /^(\+33|0)[1-9](\d{8})$/,
      'Numéro de téléphone invalide (ex : 0612345678)'
    ),
  email: z
    .string()
    .email('Adresse email invalide')
    .optional()
    .or(z.literal('')),
  commentaire: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function itemTotal(item: CartItem): number {
  return (item.prix + item.options.reduce((s, o) => s + o.prix, 0)) * item.quantite;
}

const CRENEAUX = [
  '11h30', '12h00', '12h30', '13h00', '13h30',
  '19h00', '19h30', '20h00', '20h30',
];

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Component ──────────────────────────────────────────────────────────────

export default function FormulaireCommande() {
  const { items, totalPrice } = useCart();
  const [typeRetrait, setTypeRetrait] = useState<'immediat' | 'creneau'>('immediat');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const form = e.currentTarget;
    const getValue = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? '';

    const raw = {
      nom: getValue('nom').trim(),
      telephone: getValue('telephone').trim(),
      email: getValue('email').trim(),
      commentaire: getValue('commentaire').trim(),
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as string] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    const creneau = typeRetrait === 'creneau' ? getValue('creneau') : undefined;
    if (typeRetrait === 'creneau' && !creneau) {
      setFieldErrors({ creneau: 'Veuillez sélectionner un créneau horaire' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            nom: raw.nom,
            telephone: raw.telephone,
            ...(raw.email ? { email: raw.email } : {}),
          },
          retrait: { type: typeRetrait, ...(creneau ? { creneau } : {}) },
          ...(raw.commentaire ? { commentaire: raw.commentaire } : {}),
          produits: items.map((item) => ({
            produitId: item.produitId,
            nom: item.nom,
            prix: item.prix,
            quantite: item.quantite,
            options: item.options,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json.error ?? 'Une erreur est survenue. Réessayez.');
        setLoading(false);
        return;
      }

      // Redirection vers Stripe Checkout
      window.location.href = json.url;
    } catch {
      setServerError('Impossible de contacter le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Votre commande</h1>

      {/* Récapitulatif */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Récapitulatif</h2>
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.quantite}× {item.nom}
                {item.options.length > 0 && (
                  <span className="text-gray-400"> ({item.options.map((o) => o.nom).join(', ')})</span>
                )}
              </span>
              <span className="font-medium">{formatPrix(itemTotal(item))}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between font-bold">
          <span>Total</span>
          <span>{formatPrix(totalPrice)}</span>
        </div>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom <span className="text-red-400">*</span>
          </label>
          <input name="nom" type="text" required autoComplete="name" className={inputCls} />
          {fieldErrors.nom && <p className="text-xs text-red-500 mt-1">{fieldErrors.nom}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléphone <span className="text-red-400">*</span>
          </label>
          <input
            name="telephone"
            type="tel"
            required
            placeholder="0612345678"
            autoComplete="tel"
            className={inputCls}
          />
          {fieldErrors.telephone && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.telephone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-gray-400 font-normal">(optionnel, pour confirmation)</span>
          </label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            className={inputCls}
          />
          {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type de retrait <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="typeRetrait"
                value="immediat"
                checked={typeRetrait === 'immediat'}
                onChange={() => setTypeRetrait('immediat')}
                className="accent-blue-600"
              />
              Dès que possible
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="typeRetrait"
                value="creneau"
                checked={typeRetrait === 'creneau'}
                onChange={() => setTypeRetrait('creneau')}
                className="accent-blue-600"
              />
              Créneau programmé
            </label>
          </div>
        </div>

        {typeRetrait === 'creneau' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horaire de retrait <span className="text-red-400">*</span>
            </label>
            <select name="creneau" className={inputCls}>
              <option value="">— Choisir un horaire —</option>
              {CRENEAUX.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {fieldErrors.creneau && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.creneau}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commentaire <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            name="commentaire"
            rows={2}
            placeholder="Allergies, sans oignons, etc."
            className={`${inputCls} resize-none`}
          />
        </div>

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || items.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Redirection vers le paiement…' : 'Payer →'}
        </button>
      </form>
    </div>
  );
}

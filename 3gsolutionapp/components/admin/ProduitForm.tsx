'use client';

import { useState } from 'react';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProduitData {
  _id: string;
  nom: string;
  description: string;
  categorie: string;
  prix: number; // centimes
  options: { nom: string; prix: number }[];
  actif: boolean;
}

interface ProduitFormProps {
  initial?: ProduitData;
  onSubmit: (data: ProduitFormValues) => Promise<void>;
  onCancel: () => void;
}

export interface ProduitFormValues {
  nom: string;
  description: string;
  categorie: string;
  prix: number; // centimes
  options: { nom: string; prix: number }[];
  actif: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const FormSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  description: z.string().min(1, 'La description est requise'),
  categorie: z.string().min(1, 'La catégorie est requise'),
  prixEuros: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Prix invalide (ex : 8,50)')
    .refine((v) => parseFloat(v.replace(',', '.')) >= 0, 'Le prix doit être positif'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function centimesToEuros(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',');
}

function eurosToCentimes(str: string): number {
  return Math.round(parseFloat(str.replace(',', '.')) * 100);
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProduitForm({ initial, onSubmit, onCancel }: ProduitFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<{ nom: string; prix: string }[]>(
    initial?.options.map((o) => ({ nom: o.nom, prix: centimesToEuros(o.prix) })) ?? []
  );
  const [actif, setActif] = useState(initial?.actif ?? true);

  const addOption = () => setOptions((prev) => [...prev, { nom: '', prix: '0' }]);

  const removeOption = (idx: number) =>
    setOptions((prev) => prev.filter((_, i) => i !== idx));

  const updateOption = (idx: number, field: 'nom' | 'prix', value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';

    const raw = {
      nom: get('nom').trim(),
      description: get('description').trim(),
      categorie: get('categorie').trim(),
      prixEuros: get('prix').trim(),
    };

    const parsed = FormSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as string] = err.message;
      });
      setErrors(errs);
      return;
    }

    // Valider les options
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      if (!o.nom.trim()) {
        setErrors({ options: `Option ${i + 1} : le nom est requis` });
        return;
      }
      if (!/^\d+([.,]\d{1,2})?$/.test(o.prix)) {
        setErrors({ options: `Option ${i + 1} : prix invalide` });
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        nom: raw.nom,
        description: raw.description,
        categorie: raw.categorie,
        prix: eurosToCentimes(raw.prixEuros),
        options: options.map((o) => ({
          nom: o.nom.trim(),
          prix: eurosToCentimes(o.prix),
        })),
        actif,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nom */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom <span className="text-red-400">*</span>
        </label>
        <input
          name="nom"
          defaultValue={initial?.nom}
          className={inputCls}
          placeholder="Burger Classic"
        />
        {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          name="description"
          defaultValue={initial?.description}
          rows={2}
          className={`${inputCls} resize-none`}
          placeholder="Steak haché, salade, tomate, oignons..."
        />
        {errors.description && (
          <p className="text-xs text-red-500 mt-1">{errors.description}</p>
        )}
      </div>

      {/* Catégorie + Prix */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catégorie <span className="text-red-400">*</span>
          </label>
          <input
            name="categorie"
            defaultValue={initial?.categorie}
            className={inputCls}
            placeholder="Burgers, Boissons..."
          />
          {errors.categorie && (
            <p className="text-xs text-red-500 mt-1">{errors.categorie}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prix (€) <span className="text-red-400">*</span>
          </label>
          <input
            name="prix"
            defaultValue={initial ? centimesToEuros(initial.prix) : ''}
            className={inputCls}
            placeholder="8,50"
          />
          {errors.prixEuros && (
            <p className="text-xs text-red-500 mt-1">{errors.prixEuros}</p>
          )}
        </div>
      </div>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Options / suppléments
          </label>
          <button
            type="button"
            onClick={addOption}
            className="text-xs text-blue-600 hover:underline"
          >
            + Ajouter une option
          </button>
        </div>
        {options.length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucune option pour ce produit.</p>
        )}
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={opt.nom}
                onChange={(e) => updateOption(idx, 'nom', e.target.value)}
                placeholder="Ex : Fromage supplémentaire"
                className={`${inputCls} flex-1`}
              />
              <input
                value={opt.prix}
                onChange={(e) => updateOption(idx, 'prix', e.target.value)}
                placeholder="0,50"
                className={`${inputCls} w-24`}
              />
              <span className="text-xs text-gray-400">€</span>
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="text-red-400 hover:text-red-600 text-sm font-bold px-1"
                title="Supprimer cette option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {errors.options && <p className="text-xs text-red-500 mt-1">{errors.options}</p>}
      </div>

      {/* Statut */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Statut :</label>
        <button
          type="button"
          onClick={() => setActif((v) => !v)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {actif ? 'Actif' : 'Inactif'}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer le produit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

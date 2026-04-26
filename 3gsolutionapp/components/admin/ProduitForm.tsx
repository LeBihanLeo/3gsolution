'use client';

import { useState } from 'react';
import { z } from 'zod';
import DropZone from '@/components/admin/DropZone';
import { PRODUIT_CATEGORIES } from '@/lib/produit-categories';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProduitData {
  _id: string;
  nom: string;
  description: string;
  categorie: string;
  prix: number; // centimes
  taux_tva: 0 | 5.5 | 10 | 20; // TICK-128
  options: { nom: string; prix: number }[];
  imageUrl?: string; // TICK-037
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
  taux_tva: 0 | 5.5 | 10 | 20; // TICK-128
  options: { nom: string; prix: number }[];
  imageUrl?: string | null; // TICK-037 — null = supprimer l'image existante
  actif: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const FormSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  description: z.string().min(1, 'La description est requise'),
  categorie: z.string().min(1, 'La catégorie est requise'),
  prixEuros: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, 'Prix invalide (ex : 8,50)'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function centimesToEuros(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',');
}

function eurosToCentimes(str: string): number {
  return Math.round(parseFloat(str.replace(',', '.')) * 100);
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

const inputFlexCls =
  'flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Component ────────────────────────────────────────────────────────────────

const TVA_OPTIONS: { label: string; value: 0 | 5.5 | 10 | 20 }[] = [
  { label: 'Standard (10 %)', value: 10 },
  { label: 'Alcool (20 %)', value: 20 },
  { label: 'Alimentaire (5,5 %)', value: 5.5 },
  { label: 'Pas de TVA', value: 0 },
];

export default function ProduitForm({ initial, onSubmit, onCancel }: ProduitFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<{ nom: string; prix: string }[]>(
    initial?.options.map((o) => ({ nom: o.nom, prix: centimesToEuros(o.prix) })) ?? []
  );
  const [actif, setActif] = useState(initial?.actif ?? true);
  // TICK-037 — null = image explicitement supprimée, undefined = jamais définie
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  // TICK-128 — taux TVA
  const [tauxTva, setTauxTva] = useState<0 | 5.5 | 10 | 20>(initial?.taux_tva ?? 10);
  const [categorie, setCategorie] = useState<string>(initial?.categorie ?? PRODUIT_CATEGORIES[0]);
  // Catégorie legacy : valeur existante hors de la liste prédéfinie (ancienne saisie libre)
  const isLegacyCategorie = initial?.categorie && !(PRODUIT_CATEGORIES as readonly string[]).includes(initial.categorie);
  const [prixEurosStr, setPrixEurosStr] = useState<string>(initial ? centimesToEuros(initial.prix) : '');

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
      prixEuros: prixEurosStr.trim(),
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
        taux_tva: tauxTva, // TICK-128
        options: options.map((o) => ({
          nom: o.nom.trim(),
          prix: eurosToCentimes(o.prix),
        })),
        imageUrl, // TICK-037 — string = image, null = supprimer, undefined = pas de changement
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
          <select
            name="categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className={inputCls}
          >
            {isLegacyCategorie && (
              <option value={initial!.categorie}>{initial!.categorie}</option>
            )}
            {PRODUIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.categorie && (
            <p className="text-xs text-red-500 mt-1">{errors.categorie}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prix de vente (€) <span className="text-red-400">*</span>
          </label>
          <input
            name="prix"
            value={prixEurosStr}
            onChange={(e) => setPrixEurosStr(e.target.value)}
            className={inputCls}
            placeholder="8,50"
          />
          {errors.prixEuros && (
            <p className="text-xs text-red-500 mt-1">{errors.prixEuros}</p>
          )}
        </div>
      </div>

      {/* Taux de TVA — TICK-128 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Taux de TVA
        </label>
        <select
          value={tauxTva}
          onChange={(e) => setTauxTva(parseFloat(e.target.value) as 0 | 5.5 | 10 | 20)}
          className={inputCls}
        >
          {TVA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Détail fiscal — repliable, visible uniquement si taux_tva !== 0 — TICK-128 */}
      {tauxTva !== 0 && (() => {
        const prixCentimes = eurosToCentimes(prixEurosStr);
        const prixHT = prixCentimes / (1 + tauxTva / 100);
        const montantTVA = prixCentimes - prixHT;
        return (
          <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 select-none">
              Détail fiscal
            </summary>
            <div className="mt-2 space-y-1 text-sm text-gray-700">
              <p>Prix hors taxes : <span className="font-medium">{(prixHT / 100).toFixed(2).replace('.', ',')} €</span></p>
              <p>Dont TVA ({tauxTva} %) : <span className="font-medium">{(montantTVA / 100).toFixed(2).replace('.', ',')} €</span></p>
            </div>
          </details>
        );
      })()}

      {/* Image produit — TICK-037 */}
      <DropZone
        label="Image du produit"
        aspectRatio="square"
        currentImageUrl={initial?.imageUrl}
        onUploadSuccess={(url) => setImageUrl(url)}
        onRemove={() => setImageUrl(null)}
      />

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
                className={inputFlexCls}
              />
              <input
                value={opt.prix}
                onChange={(e) => updateOption(idx, 'prix', e.target.value)}
                placeholder="0,50"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

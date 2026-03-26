// TICK-099 — Transitions complètes : payee → en_preparation → prete → recuperee
// TICK-104 — Transitions visibles par statut
// TICK-107 — Bouton "Anonymiser" retiré de l'UI (route DELETE /api/commandes/[id] conservée)
'use client';

import { useState } from 'react';

interface ProduitSnapshot {
  nom: string;
  prix: number;
  quantite: number;
  options: { nom: string; prix: number }[];
}

export type StatutCommande = 'en_attente_paiement' | 'payee' | 'en_preparation' | 'prete' | 'recuperee';

export interface CommandeData {
  _id: string;
  statut: StatutCommande;
  client: { nom: string; telephone: string; email?: string };
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  produits: ProduitSnapshot[];
  commentaire?: string;
  total: number; // centimes
  createdAt: string;
}

interface CommandeRowProps {
  commande: CommandeData;
  onAdvance: (id: string, statut: StatutCommande) => Promise<void>;
}

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function idCourt(id: string): string {
  return id.slice(-6).toUpperCase();
}

const STATUT_LABEL: Record<StatutCommande, string> = {
  en_attente_paiement: 'En attente',
  payee: 'Payée',
  en_preparation: 'En préparation',
  prete: 'Prête',
  recuperee: 'Récupérée',
};

const STATUT_STYLE: Record<StatutCommande, string> = {
  en_attente_paiement: 'bg-yellow-100 text-yellow-700',
  payee: 'bg-blue-100 text-blue-700',
  en_preparation: 'bg-amber-100 text-amber-700',
  prete: 'bg-green-100 text-green-700',
  recuperee: 'bg-gray-100 text-gray-500',
};

// Transitions admin — TICK-099
const TRANSITION_NEXT: Partial<Record<StatutCommande, { label: string; statut: StatutCommande; className: string }>> = {
  payee: { label: 'En préparation →', statut: 'en_preparation', className: 'bg-amber-500 hover:bg-amber-600 text-white' },
  en_preparation: { label: 'Prête →', statut: 'prete', className: 'bg-green-600 hover:bg-green-700 text-white' },
  prete: { label: 'Récupérée ✓', statut: 'recuperee', className: 'bg-gray-700 hover:bg-gray-800 text-white' },
};

export default function CommandeRow({ commande, onAdvance }: CommandeRowProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const heure = new Date(commande.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const transition = TRANSITION_NEXT[commande.statut];

  const handleAdvance = async () => {
    if (!transition) return;
    setLoading(true);
    await onAdvance(commande._id, transition.statut);
    setLoading(false);
  };

  const retrait =
    commande.retrait.type === 'immediat'
      ? 'Dès que possible'
      : `À ${commande.retrait.creneau}`;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 transition-all">
      {/* Ligne principale */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
            #{idCourt(commande._id)}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_STYLE[commande.statut]}`}
          >
            {STATUT_LABEL[commande.statut]}
          </span>
          <span className="text-xs text-gray-400">{heure}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{formatPrix(commande.total)}</span>

          {/* Bouton transition suivante */}
          {transition && (
            <button
              onClick={handleAdvance}
              disabled={loading}
              className={`disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${transition.className}`}
            >
              {loading ? '…' : transition.label}
            </button>
          )}

        </div>
      </div>

      {/* Infos client */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
        <span className="font-medium">{commande.client.nom}</span>
        <span className="text-gray-500">{commande.client.telephone}</span>
        <span className="text-gray-500">{retrait}</span>
      </div>

      {/* Détail produits (dépliable) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-blue-600 hover:underline"
      >
        {expanded ? '▲ Masquer le détail' : '▼ Voir le détail'}
      </button>

      {expanded && (
        <div className="mt-2 border-t pt-2 space-y-1">
          {commande.produits.map((p, idx) => (
            <div key={idx} className="text-sm text-gray-700 flex justify-between">
              <span>
                {p.quantite}× {p.nom}
                {p.options.length > 0 && (
                  <span className="text-gray-400 text-xs">
                    {' '}({p.options.map((o) => o.nom).join(', ')})
                  </span>
                )}
              </span>
              <span className="text-gray-500">
                {formatPrix((p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite)}
              </span>
            </div>
          ))}
          {commande.commentaire && (
            <p className="text-xs text-gray-500 italic mt-1">
              Note : {commande.commentaire}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

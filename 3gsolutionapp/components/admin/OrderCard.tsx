'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';
import { CommandeData, StatutCommande } from './CommandeRow';

interface OrderCardProps {
  commande: CommandeData;
  onAdvance: (id: string, statut: StatutCommande) => Promise<void>;
}

const ACTION_NEXT: Partial<Record<StatutCommande, { label: string; statut: StatutCommande; className: string }>> = {
  payee: { label: 'Préparer', statut: 'en_preparation', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  en_preparation: { label: 'Marquer prête', statut: 'prete', className: 'bg-orange-500 hover:bg-orange-600 text-white' },
  prete: { label: 'Remise effectuée', statut: 'recuperee', className: 'bg-green-600 hover:bg-green-700 text-white' },
};

const CARD_BORDER: Partial<Record<StatutCommande, string>> = {
  payee: 'border border-[rgb(195,195,195)]',
  en_preparation: 'border border-[rgb(195,195,195)]',
  prete: 'border border-[rgb(195,195,195)]',
};

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

export default function OrderCard({ commande, onAdvance }: OrderCardProps) {
  const [loading, setLoading] = useState(false);

  const action = ACTION_NEXT[commande.statut];
  const borderClass = CARD_BORDER[commande.statut] ?? 'border-gray-100';
  const idCourt = commande._id.slice(-6).toUpperCase();
  const heure = new Date(commande.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const retrait = commande.retrait.type === 'immediat' ? 'Dès que possible' : `À ${commande.retrait.creneau}`;

  const handleAdvance = async () => {
    if (!action) return;
    setLoading(true);
    await onAdvance(commande._id, action.statut);
    setLoading(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      transition={{ duration: 0.18 }}
      className={`bg-white rounded-2xl shadow-md p-4 ${borderClass}`}
    >
      {/* Ligne 1 — ID + Heure + Prix */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-gray-900 text-sm">#{idCourt}</span>
          <span className="text-xs text-gray-700 font-medium">{heure}</span>
        </div>
        <span className="text-base font-bold text-gray-900">{formatPrix(commande.total)}</span>
      </div>

      {/* Ligne 2 — Retrait */}
      <div className="text-xs text-gray-800 font-medium mb-1.5">{retrait}</div>

      {/* Ligne 3 — Client + téléphone */}
      <div className="flex items-center gap-1.5 text-xs text-gray-700 mb-3 flex-wrap">
        <Phone size={11} className="shrink-0" />
        <span className="font-medium">{commande.client.nom}</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-800">{commande.client.telephone}</span>
      </div>

      {/* Détail produits */}
      <div className="border-t border-gray-100 pt-2.5 mb-3 space-y-1.5">
        {commande.produits.map((p, idx) => (
          <div key={idx} className="text-xs text-gray-900 flex justify-between gap-2">
            <span>
              {p.quantite}× {p.nom}
              {p.options.length > 0 && (
                <span className="text-gray-600"> ({p.options.map((o) => o.nom).join(', ')})</span>
              )}
            </span>
            <span className="text-gray-700 shrink-0">
              {formatPrix((p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite)}
            </span>
          </div>
        ))}
        {commande.commentaire && (
          <p className="text-xs text-gray-700 italic mt-1">Note : {commande.commentaire}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {action && (
          <button
            onClick={handleAdvance}
            disabled={loading}
            className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 ${action.className}`}
          >
            {loading ? '…' : action.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

'use client';
// Bloc statut réutilisable : en-tête (titre + id), emoji, stepper, items
// Utilisé dans /confirmation et dans HistoriqueCommandes

import { StatutEmoji } from './StatutEmoji';
import CommandeStepper from './CommandeStepper';

export interface StatusProduit {
  nom: string;
  quantite: number;
}

interface CommandeStatusCardProps {
  statut: string;
  commandeId: string;
  produits: StatusProduit[];
}

const STATUT_DESCRIPTION: Record<string, string> = {
  payee:          'Votre commande a été transmise au restaurateur.',
  en_preparation: 'Votre commande est en cours de préparation.',
  prete:          'Votre commande est prête, vous pouvez venir la récupérer.',
  recuperee:      'Merci pour votre commande, bon appétit !',
};

function idCourt(id: string) {
  return id.slice(-6).toUpperCase();
}

export function CommandeStatusCard({ statut, commandeId, produits }: CommandeStatusCardProps) {
  return (
    <div className="space-y-4">
      {/* En-tête : titre à gauche, ID à droite */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">
          Statut de ta commande
        </p>
        <span className="font-mono text-xs font-bold text-brand bg-brand-light px-2 py-0.5 rounded-full">
          #{idCourt(commandeId)}
        </span>
      </div>

      {/* Emoji + description */}
      <div className="flex flex-col items-center gap-2">
        <StatutEmoji statut={statut} size="text-6xl" />
        <p className="text-sm text-center text-secondary">
          {STATUT_DESCRIPTION[statut] ?? ''}
        </p>
      </div>

      {/* Stepper */}
      <div className="pt-2">
        <CommandeStepper statut={statut} />
      </div>

      {/* Items */}
      <ul className="space-y-0.5 border-t border-gray-100 pt-3">
        {produits.map((p, i) => (
          <li key={i} className="text-sm text-gray-700">
            {p.quantite}× {p.nom}
          </li>
        ))}
      </ul>
    </div>
  );
}

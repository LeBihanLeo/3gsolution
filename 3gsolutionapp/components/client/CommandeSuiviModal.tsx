'use client';
// TICK-097 — Modale de suivi d'une commande en cours

import { useEffect, useRef } from 'react';
import CommandeStepper from './CommandeStepper';

interface ProduitSnapshot {
  produitId: string;
  nom: string;
  quantite: number;
  prix: number;
  options: { nom: string; prix: number }[];
}

interface CommandeEnCours {
  _id: string;
  statut: string;
  produits: ProduitSnapshot[];
  total: number;
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  createdAt: string;
}

interface CommandeSuiviModalProps {
  commande: CommandeEnCours;
  onClose: () => void;
}

function idCourt(id: string) {
  return id.slice(-6).toUpperCase();
}

function formatPrix(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommandeSuiviModal({ commande, onClose }: CommandeSuiviModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    // Fermer sur clic fond sombre
    const handleBackdrop = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    dialog.addEventListener('click', handleBackdrop);
    return () => dialog.removeEventListener('click', handleBackdrop);
  }, [onClose]);

  // Fermer sur Escape (natif dialog + handler explicite pour notifier le parent)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = () => onClose();
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      role="dialog"
      aria-labelledby="suivi-modal-titre"
      className="
        w-full max-w-lg rounded-2xl p-0 shadow-2xl
        backdrop:bg-black/50
        m-auto
        max-h-[90dvh] overflow-y-auto
      "
    >
      <div className="p-5 space-y-5">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span id="suivi-modal-titre" className="font-mono font-bold text-gray-900 text-lg">
                #{idCourt(commande._id)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{formatDateHeure(commande.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="pb-2">
          <CommandeStepper statut={commande.statut} />
        </div>

        {/* Créneau */}
        <div className="text-sm text-gray-700">
          <span className="font-medium">Retrait : </span>
          {commande.retrait.type === 'immediat' ? 'Dès que possible' : commande.retrait.creneau}
        </div>

        {/* Produits */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Commande</p>
          <ul className="space-y-2">
            {commande.produits.map((p, i) => (
              <li key={i} className="flex justify-between gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{p.quantite}× {p.nom}</span>
                  {p.options.length > 0 && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      {p.options.map((o) => o.nom).join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-gray-700 shrink-0">
                  {formatPrix(p.prix * p.quantite + p.options.reduce((s, o) => s + o.prix, 0) * p.quantite)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="font-bold text-gray-900">{formatPrix(commande.total)}</span>
        </div>

        {/* Bouton fermer mobile */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          Fermer
        </button>
      </div>
    </dialog>
  );
}

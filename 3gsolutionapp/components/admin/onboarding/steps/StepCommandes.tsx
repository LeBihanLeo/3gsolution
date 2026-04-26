'use client';
// TICK-197 — Step 4 : Présentation du système de commandes et du Kanban

import { useEffect } from 'react';
import type { StepProps } from '../types';

// Mockup statique des colonnes Kanban
const KANBAN_COLS = [
  {
    id: 'payee',
    label: 'Payée',
    color: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    desc: 'Nouvelle commande reçue',
    items: ['Burger Classic × 2', 'Frites × 1'],
  },
  {
    id: 'preparation',
    label: 'En préparation',
    color: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    desc: 'En cours de préparation',
    items: ['Pizza Margherita × 1'],
  },
  {
    id: 'prete',
    label: 'Prête',
    color: 'bg-green-50 border-green-200',
    dot: 'bg-green-500',
    text: 'text-green-700',
    desc: 'Prête à être récupérée',
    items: ['Salade César × 1', 'Eau × 2'],
  },
  {
    id: 'recuperee',
    label: 'Récupérée',
    color: 'bg-gray-50 border-gray-200',
    dot: 'bg-gray-400',
    text: 'text-gray-500',
    desc: 'Commande livrée',
    items: [],
  },
];

export default function StepCommandes({ onNext, onMarkStep, stepId }: StepProps) {
  // Étape informationnelle — on marque automatiquement au montage
  useEffect(() => {
    onMarkStep(stepId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Gérez vos commandes en temps réel</h2>
        <p className="text-sm text-gray-500 mt-1">
          Votre tableau de bord affiche toutes les commandes en cours. Glissez-déposez pour changer leur statut.
        </p>
      </div>

      {/* Kanban mockup */}
      <div className="grid grid-cols-4 gap-2">
        {KANBAN_COLS.map((col) => (
          <div key={col.id} className={`rounded-xl border ${col.color} p-3 space-y-2`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span className={`text-xs font-bold ${col.text} uppercase tracking-wide`}>{col.label}</span>
            </div>
            {col.items.length > 0 ? (
              col.items.map((item, i) => (
                <div key={i} className="bg-white rounded-lg px-2 py-1.5 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-700">{item}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-300 italic text-center py-2">—</p>
            )}
          </div>
        ))}
      </div>

      {/* Flèche de flux */}
      <div className="flex items-center justify-center gap-1 text-gray-400 text-xs">
        <span className="font-medium text-gray-600">Payée</span>
        <span>→</span>
        <span className="font-medium text-gray-600">En préparation</span>
        <span>→</span>
        <span className="font-medium text-gray-600">Prête</span>
        <span>→</span>
        <span className="font-medium text-gray-600">Récupérée</span>
      </div>

      {/* Actions disponibles */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Ce que vous pouvez faire :</p>
        <ul className="space-y-2">
          {[
            { icon: '↕', text: 'Glisser-déposer les commandes entre colonnes pour changer leur statut' },
            { icon: '✓', text: 'Marquer une commande comme "Prête" ou "Récupérée" en un clic' },
            { icon: '🔔', text: 'Actualisation automatique toutes les 30 secondes' },
            { icon: '📥', text: 'Exporter vos commandes en CSV depuis le bouton "Export" en haut de la page' },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-gray-600">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-base">
                {icon}
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onNext}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        Continuer →
      </button>
    </div>
  );
}

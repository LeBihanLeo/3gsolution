'use client';
// TICK-197 — Step 4 : Kanban interactif — l'admin doit faire avancer la commande jusqu'à Récupérée

import { useState, useEffect } from 'react';
import type { StepProps } from '../types';

const COLUMNS = [
  { id: 'payee',          label: 'Payée',           color: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  { id: 'en_preparation', label: 'En préparation',  color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  { id: 'prete',          label: 'Prête',            color: 'bg-green-50 border-green-200', dot: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  { id: 'recuperee',      label: 'Récupérée',        color: 'bg-gray-50 border-gray-200',   dot: 'bg-gray-400',   text: 'text-gray-500',   badge: 'bg-gray-100 text-gray-500' },
] as const;

type ColId = typeof COLUMNS[number]['id'];

const ORDER_FLOW: ColId[] = ['payee', 'en_preparation', 'prete', 'recuperee'];

const FAKE_ORDER = {
  client: 'Marie D.',
  articles: ['Burger Classic × 2', 'Frites × 1'],
  total: '16,50 €',
};

export default function StepCommandes({ onNext, onMarkStep, stepId }: StepProps) {
  const [orderCol, setOrderCol] = useState<ColId>('payee');
  const [done, setDone] = useState(false);

  async function advance() {
    const idx = ORDER_FLOW.indexOf(orderCol);
    if (idx < ORDER_FLOW.length - 1) {
      const next = ORDER_FLOW[idx + 1];
      setOrderCol(next);
      if (next === 'recuperee') {
        setDone(true);
        await onMarkStep(stepId);
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Gérez vos commandes en temps réel</h2>
        <p className="text-sm text-gray-500 mt-1">
          Faites avancer la commande ci-dessous jusqu&apos;à &laquo;&nbsp;Récupérée&nbsp;&raquo; pour découvrir le fonctionnement du Kanban.
        </p>
      </div>

      {/* Instruction contextuelle */}
      {!done && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-blue-500 text-lg">💡</span>
          <p className="text-sm text-blue-700">
            Cliquez sur <strong>Avancer →</strong> sur la commande pour la faire passer à l&apos;étape suivante.
          </p>
        </div>
      )}
      {done && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-green-500 text-xl">✓</span>
          <p className="text-sm text-green-700 font-medium">
            Parfait ! La commande est récupérée. Vous maîtrisez le Kanban !
          </p>
        </div>
      )}

      {/* Kanban */}
      <div className="grid grid-cols-4 gap-2">
        {COLUMNS.map((col) => {
          const hasOrder = col.id === orderCol;
          return (
            <div key={col.id} className={`rounded-xl border ${col.color} p-3 space-y-2 min-h-[120px]`}>
              {/* En-tête colonne */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`text-xs font-bold ${col.text} uppercase tracking-wide leading-tight`}>
                  {col.label}
                </span>
              </div>

              {hasOrder ? (
                <div className="bg-white rounded-lg px-2 py-2 shadow-sm border border-gray-100 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-800">{FAKE_ORDER.client}</p>
                  {FAKE_ORDER.articles.map((a) => (
                    <p key={a} className="text-xs text-gray-500">{a}</p>
                  ))}
                  <p className="text-xs font-bold text-gray-700">{FAKE_ORDER.total}</p>

                  {col.id !== 'recuperee' && (
                    <button
                      onClick={advance}
                      className="w-full mt-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors"
                    >
                      Avancer →
                    </button>
                  )}
                  {col.id === 'recuperee' && (
                    <span className="inline-block text-xs text-green-600 font-semibold">✓ Récupérée</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-300 italic text-center py-2">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Flux */}
      <div className="flex items-center justify-center gap-1 text-gray-400 text-xs">
        {COLUMNS.map((col, i) => (
          <span key={col.id} className="flex items-center gap-1">
            <span className={`font-medium ${orderCol === col.id ? 'text-blue-600' : 'text-gray-500'}`}>
              {col.label}
            </span>
            {i < COLUMNS.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Ce que vous pouvez faire :</p>
        <ul className="space-y-2">
          {[
            { icon: '↕', text: 'Glisser-déposer les commandes entre colonnes pour changer leur statut' },
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

      {done && (
        <button
          onClick={onNext}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          Continuer →
        </button>
      )}
    </div>
  );
}

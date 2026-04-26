'use client';
// TICK-193 — Step 0 : Bienvenue — écran d'accueil du wizard onboarding

import type { StepProps } from '../types';

const ETAPES = [
  { icon: '🎨', label: 'Personnalisation', desc: 'Nom, couleurs, bannière et horaires' },
  { icon: '🍽',  label: 'Menu',             desc: 'Ajoutez vos premiers produits' },
  { icon: '💳', label: 'Paiements',         desc: 'Connectez votre compte Stripe' },
  { icon: '📋', label: 'Commandes',         desc: 'Découvrez le tableau Kanban' },
  { icon: '🔒', label: 'Sécurité',          desc: 'Activez le 2FA pour protéger votre compte' },
];

export default function StepBienvenue({ onNext }: StepProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-6">
      {/* En-tête */}
      <div className="text-center space-y-2">
        <span className="text-5xl">👋</span>
        <h1 className="text-2xl font-bold text-gray-900">Bienvenue sur 3G Solution !</h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Configurons votre restaurant en quelques minutes. Voici les étapes qui vous attendent :
        </p>
      </div>

      {/* Liste des étapes */}
      <ul className="space-y-3">
        {ETAPES.map((e, i) => (
          <li key={e.label} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-lg shrink-0">
              {e.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{i + 1}. {e.label}</p>
              <p className="text-xs text-gray-500">{e.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={onNext}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
      >
        Commencer la configuration →
      </button>
    </div>
  );
}

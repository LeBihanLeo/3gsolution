'use client';
// TICK-192 — Barre de progression du wizard onboarding

export interface OnboardingStepMeta {
  id: string;
  label: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { id: 'bienvenue',       label: 'Bienvenue',         icon: '👋' },
  { id: 'personnalisation', label: 'Personnalisation', icon: '🎨' },
  { id: 'menu',            label: 'Menu',              icon: '🍽' },
  { id: 'stripe',          label: 'Paiements',         icon: '💳' },
  { id: 'commandes',       label: 'Commandes',         icon: '📋' },
  { id: '2fa',             label: 'Sécurité',          icon: '🔒' },
];

interface Props {
  currentIndex: number;
  completedSteps: string[];
}

export default function OnboardingStepper({ currentIndex, completedSteps }: Props) {
  return (
    <div className="w-full">
      {/* Barre de progression */}
      <div className="relative flex items-center justify-between mb-2">
        {/* Ligne de fond */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200" />
        {/* Ligne de progression */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 transition-all duration-500"
          style={{ width: `${(Math.min(currentIndex, ONBOARDING_STEPS.length - 1) / (ONBOARDING_STEPS.length - 1)) * 100}%` }}
        />

        {ONBOARDING_STEPS.map((step, i) => {
          const isDone = completedSteps.includes(step.id);
          const isCurrent = i === currentIndex;
          const isPast = i < currentIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all duration-300
                  ${isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-110'
                    : isDone || isPast
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                  }`}
              >
                {isDone && !isCurrent ? '✓' : step.icon}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors ${
                  isCurrent ? 'text-blue-700' : isPast || isDone ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Indicateur mobile */}
      <p className="text-center text-xs text-gray-500 sm:hidden mt-1">
        Étape {Math.min(currentIndex + 1, ONBOARDING_STEPS.length)} sur {ONBOARDING_STEPS.length} — {ONBOARDING_STEPS[Math.min(currentIndex, ONBOARDING_STEPS.length - 1)]?.label ?? ''}
      </p>
    </div>
  );
}

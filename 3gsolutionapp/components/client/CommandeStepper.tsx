'use client';
// TICK-099 — Stepper visuel 4 étapes du cycle de vie d'une commande
// Redesign — dots + ligne, palette tokens app (--primary, orange-200, gray-200)

import { useEffect, useRef, useState } from 'react';

export type StatutCommande = 'en_attente_paiement' | 'payee' | 'en_preparation' | 'prete' | 'recuperee';

interface Step { statut: StatutCommande; label: string; }

const STEPS: Step[] = [
  { statut: 'payee',          label: 'Confirmé'    },
  { statut: 'en_preparation', label: 'Préparation' },
  { statut: 'prete',          label: 'Prêt'        },
  { statut: 'recuperee',      label: 'Récupéré'    },
];

const ORDER: Record<string, number> = {
  en_attente_paiement: -1,
  payee:               0,
  en_preparation:      1,
  prete:               2,
  recuperee:           3,
};

interface CommandeStepperProps {
  statut: string;
  compact?: boolean;
}

// ── Sous-composants animés ─────────────────────────────────────────────────
// Chaque remount (via changement de key) rejoue son animation CSS depuis le début.

interface DotProps {
  isActive: boolean;
  isCompleted: boolean;
  dotFill: string;
  dotRing: string;
  pingColor: string;
  ariaLabel: string;
  delay: string;
}

function Dot({ isActive, isCompleted, dotFill, dotRing, pingColor, ariaLabel, delay }: DotProps) {
  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      aria-label={ariaLabel}
      style={{ animation: 'stepper-dot-in 0.35s ease-out both', animationDelay: delay }}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className={`absolute rounded-full opacity-50 w-3.5 h-3.5 animate-[ping_2s_ease-out_infinite] ${pingColor}`}
        />
      )}
      <span
        className={[
          'rounded-full block transition-colors duration-300',
          isActive
            ? `w-3.5 h-3.5 ring-2 ring-offset-2 ${dotRing} ${dotFill}`
            : 'w-2.5 h-2.5',
          !isActive && (isCompleted ? dotFill : 'bg-gray-200'),
        ].join(' ')}
      />
    </div>
  );
}

interface LineProps {
  isCompleted: boolean;
  lineFill: string;
  delay: string;
}

function Line({ isCompleted, lineFill, delay }: LineProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex-1 h-0.5 origin-left ${isCompleted ? lineFill : 'bg-gray-200'}`}
      style={{ animation: 'stepper-line-in 0.3s ease-out both', animationDelay: delay }}
    />
  );
}

// ── Composant principal ────────────────────────────────────────────────────

export default function CommandeStepper({ statut, compact = false }: CommandeStepperProps) {
  const currentOrder = ORDER[statut] ?? 0;
  const isGreen = statut === 'prete' || statut === 'recuperee';

  const dotFill   = isGreen ? 'bg-green-500'               : 'bg-brand';
  const dotRing   = isGreen ? 'ring-green-200'             : 'ring-orange-200';
  const pingColor = isGreen ? 'bg-green-500'               : 'bg-brand';
  const lineFill  = isGreen ? 'bg-green-500'               : 'bg-brand';
  const labelActive  = isGreen ? 'text-green-600 font-semibold' : 'text-brand font-semibold';
  const labelDone    = isGreen ? 'text-green-500 opacity-60'    : 'text-brand opacity-60';

  // Clés d'animation individuelles — s'incrémentent uniquement pour l'élément
  // qui vient d'être atteint, déclenchant son remount et donc son animation.
  const [dotKeys,  setDotKeys]  = useState<number[]>(STEPS.map(() => 0));
  const [lineKeys, setLineKeys] = useState<number[]>(STEPS.map(() => 0));
  const prevOrderRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevOrderRef.current;
    if (prev === null) {
      // Premier rendu : on mémorise le statut initial, pas d'animation ciblée
      prevOrderRef.current = currentOrder;
      return;
    }
    if (currentOrder > prev) {
      // Avancement : animer uniquement le nouveau dot actif + le connecteur qui vient de se remplir
      setDotKeys( k => { const n = [...k]; n[currentOrder]++;  return n; });
      setLineKeys(k => { const n = [...k]; n[prev]++;          return n; });
      prevOrderRef.current = currentOrder;
    }
  }, [currentOrder]);

  return (
    <div className="w-full" aria-label="Étapes de la commande" role="list">

      {/* ── Rangée dots + connecteurs ── */}
      <div className="flex items-center w-full">
        {STEPS.map((step, index) => {
          const stepOrder   = ORDER[step.statut];
          const isCompleted = stepOrder < currentOrder;
          const isActive    = stepOrder === currentOrder;
          const isLast      = index === STEPS.length - 1;

          // Au montage initial : stagger classique. Après avancement : instantané.
          const dotDelay  = dotKeys[index]  === 0 ? `${index * 120}ms`      : '0ms';
          const lineDelay = lineKeys[index] === 0 ? `${index * 120 + 60}ms` : '0ms';

          return (
            <div key={step.statut} className="flex items-center flex-1 last:flex-none" role="listitem">
              <Dot
                key={`dot-${step.statut}-${dotKeys[index]}`}
                isActive={isActive}
                isCompleted={isCompleted}
                dotFill={dotFill}
                dotRing={dotRing}
                pingColor={pingColor}
                ariaLabel={`${step.label}${isActive ? ' (étape actuelle)' : isCompleted ? ' (terminé)' : ''}`}
                delay={dotDelay}
              />
              {!isLast && (
                <Line
                  key={`line-${index}-${lineKeys[index]}`}
                  isCompleted={isCompleted}
                  lineFill={lineFill}
                  delay={lineDelay}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Labels alignés sous chaque dot ── */}
      {!compact && (
        <div className="flex w-full mt-2">
          {STEPS.map((step, index) => {
            const stepOrder   = ORDER[step.statut];
            const isCompleted = stepOrder < currentOrder;
            const isActive    = stepOrder === currentOrder;

            return (
              <div
                key={step.statut}
                className="flex-1 last:flex-none flex justify-center"
                style={{ animation: 'stepper-dot-in 0.3s ease-out both', animationDelay: `${index * 120 + 30}ms` }}
              >
                <span
                  className={[
                    'text-[11px] text-center leading-tight',
                    isActive    ? labelActive :
                    isCompleted ? labelDone   :
                                  'text-muted',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';
// TICK-192 — Wizard principal onboarding admin
// Gère la navigation entre étapes, la persistance en DB, et les transitions Framer Motion.

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import OnboardingStepper, { ONBOARDING_STEPS } from './OnboardingStepper';
import StepBienvenue from './steps/StepBienvenue';
import StepPersonnalisation from './steps/StepPersonnalisation';
import StepMenu from './steps/StepMenu';
import StepStripe from './steps/StepStripe';
import StepCommandes from './steps/StepCommandes';
import Step2FA from './steps/Step2FA';
import StepFin from './steps/StepFin';

const STEP_COMPONENTS = [
  StepBienvenue,
  StepPersonnalisation,
  StepMenu,
  StepStripe,
  StepCommandes,
  Step2FA,
  StepFin,
];

// Animations de transition entre steps
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Permet de revenir à step=3 (Stripe) après le retour OAuth
  const initialStep = (() => {
    const s = searchParams.get('step');
    const n = s ? parseInt(s, 10) : 0;
    return isNaN(n) || n < 0 || n >= STEP_COMPONENTS.length ? 0 : n;
  })();

  const [currentIndex, setCurrentIndex] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Charge l'état depuis l'API au montage
  useEffect(() => {
    fetch('/api/admin/onboarding')
      .then((r) => r.json())
      .then((data) => {
        if (data.steps) setCompletedSteps(data.steps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markStep = useCallback(async (stepId: string) => {
    if (completedSteps.includes(stepId)) return;
    setCompletedSteps((prev) => [...prev, stepId]);
    await fetch('/api/admin/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId }),
    }).catch(() => {});
  }, [completedSteps]);

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentIndex((i) => Math.min(i + 1, STEP_COMPONENTS.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const completeOnboarding = useCallback(async () => {
    await fetch('/api/admin/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completeAll: true }),
    }).catch(() => {});
    router.push('/espace-restaurateur');
  }, [router]);

  const StepComponent = STEP_COMPONENTS[currentIndex];
  const isLastStep = currentIndex === STEP_COMPONENTS.length - 1;
  // Bienvenue (index 0) et Fin (dernier) : pas de boutons nav standard
  const showNav = currentIndex > 0 && !isLastStep;
  const stepId = ONBOARDING_STEPS[currentIndex]?.id ?? '';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-blue-700 tracking-wider uppercase">3G Solution</span>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} / {STEP_COMPONENTS.length}
          </span>
        </div>
        <OnboardingStepper currentIndex={currentIndex} completedSteps={completedSteps} />
      </div>

      {/* Contenu de l'étape */}
      <div className="w-full max-w-2xl flex-1 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex-1 flex flex-col"
          >
            <StepComponent
              onNext={goNext}
              onPrev={goPrev}
              onSkip={goNext}
              onComplete={completeOnboarding}
              onMarkStep={markStep}
              stepId={stepId}
              completedSteps={completedSteps}
              isFirst={currentIndex === 0}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation standard (steps 1→4) */}
        {showNav && (
          <div className="flex items-center justify-between pt-6 mt-4 border-t border-gray-200">
            <button
              onClick={goPrev}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              ← Précédent
            </button>
            <button
              onClick={goNext}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-2"
            >
              Passer cette étape
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

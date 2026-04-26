// TICK-192 — Props communes à tous les steps du wizard onboarding
export interface StepProps {
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => Promise<void>;
  onMarkStep: (stepId: string) => Promise<void>;
  stepId: string;
  completedSteps: string[];
  isFirst: boolean;
}

// Single source of truth for the onboarding flow order. The router still has
// one route per step (see routes.tsx); this list drives the shared progress
// indicator and the back button so they stay correct everywhere.
export interface OnboardingStep {
  path: string;
  label: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { path: '/personal-data', label: 'Tus datos' },
  { path: '/context', label: 'Tu situación' },
  { path: '/activity', label: 'Tus ingresos' },
  { path: '/bank', label: 'Tu banco' },
  { path: '/expenses-fixed', label: 'Gastos que se repiten' },
  { path: '/expenses-services', label: 'Gastos que cambian' },
  { path: '/habits', label: 'Tus hábitos' },
  { path: '/goals', label: 'Tus objetivos' },
  { path: '/preferencias', label: 'Tus prioridades' },
];

export function getStepIndex(path: string): number {
  return ONBOARDING_STEPS.findIndex((step) => step.path === path);
}

export function getPrevStepPath(path: string): string | null {
  const index = getStepIndex(path);
  if (index <= 0) return null;
  return ONBOARDING_STEPS[index - 1].path;
}

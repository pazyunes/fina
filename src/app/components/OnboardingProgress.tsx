import { ONBOARDING_STEPS, getStepIndex } from '../onboarding/steps';

interface OnboardingProgressProps {
  currentPath: string;
}

// Unified progress indicator driven by ONBOARDING_STEPS so every step shows the
// same, correct count. The current step is elongated; completed steps stay
// filled, upcoming ones are greyed out.
export function OnboardingProgress({ currentPath }: OnboardingProgressProps) {
  const currentIndex = getStepIndex(currentPath);
  // PR8 — fuera del flujo de onboarding (ej: rutas /editar/*) no tiene sentido
  // mostrar la barra; nos saltamos el render.
  if (currentIndex === -1) return null;

  return (
    <div
      className="flex justify-center items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_STEPS.length}
      aria-valuenow={currentIndex + 1}
      aria-label={`Paso ${currentIndex + 1} de ${ONBOARDING_STEPS.length}`}
    >
      {ONBOARDING_STEPS.map((step, index) => (
        <div
          key={step.path}
          className={`h-2 rounded-full transition-all duration-300 ${
            index === currentIndex
              ? 'w-6 bg-[#9A3D9E]'
              : index < currentIndex
                ? 'w-2 bg-[#9A3D9E]'
                : 'w-2 bg-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

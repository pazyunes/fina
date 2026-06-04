import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { getPrevStepPath } from '../onboarding/steps';

interface BackButtonProps {
  currentPath: string;
}

// Navigates to the previous onboarding step. Hidden on the first step. State
// lives in Main and survives the route change, so going back keeps the data.
export function BackButton({ currentPath }: BackButtonProps) {
  const navigate = useNavigate();
  const prevPath = getPrevStepPath(currentPath);

  if (!prevPath) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(prevPath)}
      className="inline-flex items-center gap-1 text-gray-500 hover:text-[#9A3D9E] transition-colors -ml-1 mb-3"
      aria-label="Volver al paso anterior"
    >
      <ArrowLeft className="w-5 h-5" />
      <span className="text-sm">Atrás</span>
    </button>
  );
}

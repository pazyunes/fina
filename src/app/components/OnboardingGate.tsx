import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';

// Wrapper para los step routes del onboarding. PR6: el onboarding es one-shot.
// Si el usuario ya tiene su informe, intentar entrar a un step lo redirige a
// /result. La excepción es la propia ruta /result (se renderiza sin gate
// adicional para no entrar en loop). Mientras hasReport está sin resolver,
// devolvemos los children igual — Main se hidrata desde DB en ese caso y la
// hidratación cubre la latencia.
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { hasReport } = useAuth();
  const { pathname } = useLocation();

  if (hasReport === true && pathname !== '/result' && pathname !== '/ai-reasoning') {
    return <Navigate to="/result" replace />;
  }

  return <>{children}</>;
}

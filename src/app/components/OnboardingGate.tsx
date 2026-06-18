import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';

// PR6/7 — Gate de los step routes del onboarding y las tabs del informe.
// Reglas:
//   - Si la usuaria YA tiene su informe y entra a un step de onboarding
//     (one-shot), la mandamos a /result.
//   - Si NO tiene informe y entra a una pestaña del informe
//     (/result, /objetivos, /inversiones, /ai-reasoning), la mandamos al
//     primer step (/personal-data) para que primero genere el informe.
//   - /loading y /perfil pasan siempre — son neutrales.
//   - hasReport === null (loading) deja pasar; Main muestra LoadingScreen
//     mientras hidrata desde DB.

const ONBOARDING_FAMILY = [
  '/personal-data',
  '/context',
  '/activity',
  '/bank',
  '/expenses-fixed',
  '/expenses-services',
  '/habits',
  '/goals',
  '/preferencias',
];

const REPORT_FAMILY = [
  '/result',
  '/objetivos',
  '/inversiones',
  '/ai-reasoning',
  // PR8 — edición desde /perfil. Requieren informe ya generado.
  '/editar/ingresos',
  '/editar/gastos-fijos',
  '/editar/gastos-variables',
  '/editar/objetivos',
];

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { hasReport } = useAuth();
  const { pathname } = useLocation();

  if (hasReport === true && ONBOARDING_FAMILY.includes(pathname)) {
    return <Navigate to="/result" replace />;
  }
  if (hasReport === false && REPORT_FAMILY.includes(pathname)) {
    return <Navigate to="/personal-data" replace />;
  }

  return <>{children}</>;
}

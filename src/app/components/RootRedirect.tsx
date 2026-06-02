import { Navigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { Splash } from './Splash';

// Entry-point en `/`. Reglas:
//   - Sin sesión → muestra Splash (FINA + 2 CTAs).
//   - Con sesión + informe ya generado → redirige a /result.
//   - Con sesión sin informe → directo al primer step del onboarding
//     (/personal-data). PR6b: ya no hay una pantalla intermedia /welcome.
// Mientras se resuelve la sesión inicial o el hasReport (null) muestra
// un loading silencioso para evitar el flash de Splash a usuarios logueados.
export function RootRedirect() {
  const { session, loading, hasReport } = useAuth();

  // Loading inicial de la sesión.
  if (loading) return <CenteredLoading />;

  // Sin sesión: pantalla de bienvenida con los dos CTAs.
  if (!session) return <Splash />;

  // Con sesión pero todavía no sabemos si tiene informe.
  if (hasReport === null) return <CenteredLoading />;

  return <Navigate to={hasReport ? '/result' : '/personal-data'} replace />;
}

function CenteredLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBEAF0] to-white flex items-center justify-center">
      <p className="text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>Cargando…</p>
    </div>
  );
}

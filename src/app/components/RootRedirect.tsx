import { Navigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { Splash } from './Splash';
import { APP_CERRADA } from '../mantenimiento';

// Entry-point en `/`. Reglas:
//   - Sin sesión → muestra Splash (FINA + 2 CTAs).
//   - Con sesión + informe ya generado → redirige a /result.
//   - Con sesión sin informe → directo al primer step del onboarding
//     (/personal-data). PR6b: ya no hay una pantalla intermedia /welcome.
// Mientras se resuelve la sesión inicial o el hasReport (null) muestra
// un loading silencioso para evitar el flash de Splash a usuarios logueados.
export function RootRedirect() {
  const { session, loading, hasReport } = useAuth();

  // Mientras la app está CERRADA (ver mantenimiento.ts), quien entra con la
  // llave va al flujo nuevo. Antes caía en el Splash del flujo viejo, que es
  // lo que sigue viviendo en `/`: el rediseño todavía no reemplazó a la app
  // real, es una ruta aparte. Sin esto, entrar por /?ver=fina mostraba la
  // pantalla vieja y había que saberse /onboarding-v2 de memoria.
  // El flujo viejo sigue alcanzable escribiendo /login, /result, etc.
  if (APP_CERRADA) return <Navigate to="/onboarding-v2" replace />;

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
    <div className="min-h-screen bg-gradient-to-br from-[#F0E7FA] to-white flex items-center justify-center">
      <p className="text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>Cargando…</p>
    </div>
  );
}

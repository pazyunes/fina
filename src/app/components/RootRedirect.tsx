import { Navigate } from 'react-router';
import { useAuth } from '../lib/auth';

// Entry-point en `/`: la app nueva (v2), que es la definitiva.
//   - Sin sesión → el onboarding, que es la puerta de entrada.
//   - Con sesión → Home. Mandar a alguien que ya tiene cuenta a rehacer el
//     onboarding sería pedirle que conteste de nuevo todo lo que ya contestó.
//
// Antes `/` llevaba al flujo viejo (Splash → /result) y sólo con la app
// cerrada redirigía al nuevo. Al abrirla, `/` tiene que seguir yendo al nuevo:
// si no, abrir la app mostraba la versión anterior. El flujo viejo sigue
// alcanzable escribiendo /login, /result, etc.
export function RootRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <CenteredLoading />;
  return <Navigate to={session ? '/onboarding-v2/home' : '/onboarding-v2'} replace />;
}

function CenteredLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0E7FA] to-white flex items-center justify-center">
      <p className="text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>Cargando…</p>
    </div>
  );
}

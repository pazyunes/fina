import { Navigate } from 'react-router';
import { useAuth } from '../lib/auth';

// Entry-point en `/`: la app nueva (v2), que es la definitiva.
//   - Sin sesión → el onboarding, que es la puerta de entrada.
//   - Con sesión → Home. Mandar a alguien que ya tiene cuenta a rehacer el
//     onboarding sería pedirle que conteste de nuevo todo lo que ya contestó.
//
// La app vieja (v1) ya no existe: sus direcciones (/login, /result, etc.)
// redirigen a su equivalente en la v2 desde routes.tsx.
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

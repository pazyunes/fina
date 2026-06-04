import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';

// Envuelve rutas que requieren sesión. Sin sesión → redirige a /login,
// recordando de dónde venía para volver después de loguear.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-[#F1E8F8] flex items-center justify-center">
        <p className="text-gray-500" style={{ fontFamily: 'var(--font-sans)' }}>Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

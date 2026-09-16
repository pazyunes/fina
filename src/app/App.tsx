import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './lib/auth';
import { DisplayCurrencyProvider } from './lib/displayCurrency';
import { LLEGADA_DESDE_MAIL, supabase } from './lib/supabase';
import { Toaster } from './components/ui/sonner';
import { Proximamente } from './components/Proximamente';
import { resolverAcceso } from './mantenimiento';
import { COLORS } from './components/onboarding-v2/shared';

// La puerta se resuelve UNA vez, antes de montar el router y los providers:
// si está cerrada no se monta nada de la app — ni auth, ni rutas, ni fetches.
// Así no hay ventana en la que se vea un flash de la app real.
const acceso = resolverAcceso();

// Si se llegó desde el link de "¿Olvidaste tu contraseña?" pero a otra
// dirección (Supabase manda a la página principal cuando /reset-password no
// está en su lista permitida), hay que llevar a la persona a poner la
// contraseña nueva. Si no, la app ve la sesión y la manda a Home.
const desviarARecuperacion =
  (LLEGADA_DESDE_MAIL.recuperacion || !!LLEGADA_DESDE_MAIL.errorDeLink) &&
  typeof window !== 'undefined' &&
  window.location.pathname !== '/reset-password';

export default function App() {
  const [listo, setListo] = useState(!desviarARecuperacion);

  useEffect(() => {
    if (!desviarARecuperacion) return;
    // Primero se deja que Supabase termine de leer la sesión del link (getSession
    // espera a eso). Recién después se cambia la dirección: si se cambiara
    // antes, se perdería el `#` con la sesión y el link no serviría.
    void supabase.auth.getSession().finally(() => {
      void router.navigate('/reset-password', { replace: true });
      setListo(true);
    });
  }, []);

  if (!acceso) return <Proximamente />;

  return (
    <AuthProvider>
      <DisplayCurrencyProvider>
        {listo ? <RouterProvider router={router} /> : <div className="min-h-screen" style={{ background: COLORS.paper }} />}
        <Toaster richColors position="top-center" />
      </DisplayCurrencyProvider>
    </AuthProvider>
  );
}

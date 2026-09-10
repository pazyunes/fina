import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './lib/auth';
import { DisplayCurrencyProvider } from './lib/displayCurrency';
import { Toaster } from './components/ui/sonner';
import { Proximamente } from './components/Proximamente';
import { resolverAcceso } from './mantenimiento';

// La puerta se resuelve UNA vez, antes de montar el router y los providers:
// si está cerrada no se monta nada de la app — ni auth, ni rutas, ni fetches.
// Así no hay ventana en la que se vea un flash de la app real.
const acceso = resolverAcceso();

export default function App() {
  if (!acceso) return <Proximamente />;

  return (
    <AuthProvider>
      <DisplayCurrencyProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </DisplayCurrencyProvider>
    </AuthProvider>
  );
}

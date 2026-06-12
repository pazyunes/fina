import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './lib/auth';
import { DisplayCurrencyProvider } from './lib/displayCurrency';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <DisplayCurrencyProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-center" />
      </DisplayCurrencyProvider>
    </AuthProvider>
  );
}

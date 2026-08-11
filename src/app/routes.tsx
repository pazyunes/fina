import { createBrowserRouter, Outlet } from "react-router";
import { Main } from "./Main";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { Profile } from "./components/Profile";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { OnboardingGate } from "./components/OnboardingGate";
import { FeedbackController } from "./components/FeedbackModal";

// Layout que persiste entre las rutas de onboarding/informe: renderiza la
// pantalla (Outlet) + el controlador de encuestas, que detecta cuándo salís de
// una pantalla (Objetivos/Inversiones) y dispara el pop-up.
function FeedbackLayout() {
  return (
    <>
      <Outlet />
      <FeedbackController />
    </>
  );
}

export const router = createBrowserRouter([
  {
    // PR6 — `/` decide qué mostrar según sesión + hasReport.
    path: "/",
    element: <RootRedirect />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    // Pública: llega desde el link del mail de recuperación (sesión de recovery).
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/perfil",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  // Onboarding + informe: requieren sesión Y, además, OnboardingGate
  // redirige a /result si ya hay informe (excepto la propia /result y
  // /ai-reasoning, que es debug-only). El onboarding es one-shot por PR6.
  {
    // Layout persistente (FeedbackController vive acá y sobrevive a los cambios
    // de ruta para detectar cuándo salís de Objetivos/Inversiones).
    element: (
      <ProtectedRoute>
        <FeedbackLayout />
      </ProtectedRoute>
    ),
    children: [
      "/personal-data",
      "/context",
      "/activity",
      "/bank",
      "/expenses-fixed",
      "/expenses-services",
      "/habits",
      "/goals",
      "/preferencias",
      "/loading",
      "/ai-reasoning",
      "/result",
      // PR7 — pestañas adicionales del informe (Bottom Nav).
      "/objetivos",
      "/inversiones",
      // PR8 — Edición de datos desde /perfil.
      "/editar/ingresos",
      "/editar/gastos-fijos",
      "/editar/gastos-variables",
      "/editar/objetivos",
      "/editar/finanzas",
      "/editar/preferencias",
    ].map((path) => ({
      path,
      element: (
        <OnboardingGate>
          <Main />
        </OnboardingGate>
      ),
    })),
  },
]);
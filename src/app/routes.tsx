import { createBrowserRouter, Outlet } from "react-router";
import { Main } from "./Main";
import { Login } from "./components/Login";
import { ResetPassword } from "./components/ResetPassword";
import { Profile } from "./components/Profile";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { OnboardingGate } from "./components/OnboardingGate";
import { FeedbackController } from "./components/FeedbackModal";
import { OnboardingV2 } from "./components/onboarding-v2/OnboardingV2";
import { V2Layout } from "./components/onboarding-v2/V2Layout";
import { HomeV2 } from "./components/onboarding-v2/HomeV2";
import { GastosV2 } from "./components/onboarding-v2/GastosV2";
import { ObjetivosV2 } from "./components/onboarding-v2/ObjetivosV2";
import { InversionesV2 } from "./components/onboarding-v2/InversionesV2";
import { PerfilV2 } from "./components/onboarding-v2/PerfilV2";
import { GruposV2 } from "./components/onboarding-v2/GruposV2";

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
    // REDISEÑO (rama feat/rediseno-onboarding-v2) — sandbox público, sin
    // sesión ni Supabase, solo para iterar el diseño del onboarding nuevo.
    // No reemplaza /personal-data ni el resto del flujo real todavía.
    path: "/onboarding-v2",
    element: <OnboardingV2 />,
  },
  {
    // REDISEÑO — post-onboarding: Home/Gastos/Objetivos/Inversiones con el
    // menú de abajo nuevo. Mismo sandbox público, mismo estado 100% local.
    element: <V2Layout />,
    children: [
      { path: "/onboarding-v2/home", element: <HomeV2 /> },
      { path: "/onboarding-v2/gastos", element: <GastosV2 /> },
      { path: "/onboarding-v2/objetivos", element: <ObjetivosV2 /> },
      { path: "/onboarding-v2/inversiones", element: <InversionesV2 /> },
      { path: "/onboarding-v2/perfil", element: <PerfilV2 /> },
      { path: "/onboarding-v2/grupos", element: <GruposV2 /> },
    ],
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
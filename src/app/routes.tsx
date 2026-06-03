import { createBrowserRouter } from "react-router";
import { Main } from "./Main";
import { Login } from "./components/Login";
import { Profile } from "./components/Profile";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { OnboardingGate } from "./components/OnboardingGate";

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
  ...[
    "/personal-data",
    "/context",
    "/activity",
    "/bank",
    "/expenses-fixed",
    "/expenses-services",
    "/habits",
    "/goals",
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
  ].map((path) => ({
    path,
    element: (
      <ProtectedRoute>
        <OnboardingGate>
          <Main />
        </OnboardingGate>
      </ProtectedRoute>
    ),
  })),
]);
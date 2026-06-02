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
    "/welcome",
    "/personal-data",
    "/context",
    "/mensaje/ingresos",
    "/activity",
    "/bank",
    "/mensaje/gastos-fijos",
    "/expenses-fixed",
    "/mensaje/gastos-variables",
    "/expenses-services",
    "/habits",
    "/goals",
    "/loading",
    "/ai-reasoning",
    "/result",
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
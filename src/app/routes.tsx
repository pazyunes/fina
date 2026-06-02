import { createBrowserRouter } from "react-router";
import { Main } from "./Main";
import { Splash } from "./components/Splash";
import { Login } from "./components/Login";
import { Profile } from "./components/Profile";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Main,
  },
  {
    path: "/splash",
    element: <Splash />,
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
  // El onboarding y el informe requieren sesión. PR6: además de ProtectedRoute,
  // los step routes están bajo OnboardingGate (en Main.tsx) que redirige a
  // /result si el usuario ya tiene su informe — el onboarding es one-shot.
  ...[
    "/personal-data",
    "/context",
    "/activity",
    "/bank",
    "/expenses-fixed",
    "/expenses-services",
    "/habits",
    "/goals",
    "/ai-reasoning",
    "/result",
  ].map((path) => ({
    path,
    element: (
      <ProtectedRoute>
        <Main />
      </ProtectedRoute>
    ),
  })),
]);
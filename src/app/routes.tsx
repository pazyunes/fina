import { createBrowserRouter } from "react-router";
import { Main } from "./Main";
import { Splash } from "./components/Splash";
import { Login } from "./components/Login";
import { Profile } from "./components/Profile";
import { ReportView } from "./components/ReportView";
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
  {
    path: "/report/:id",
    element: (
      <ProtectedRoute>
        <ReportView />
      </ProtectedRoute>
    ),
  },
  // El onboarding y el informe requieren sesión: sin login se redirige a
  // /login y se vuelve acá después de iniciar sesión. Todas estas rutas
  // renderizan <Main>, que mantiene el estado del flujo entre pasos.
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
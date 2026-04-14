import { createBrowserRouter } from "react-router";
import { Main } from "./Main";
import { Splash } from "./components/Splash";
import { Login } from "./components/Login";
import { History } from "./components/History";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Main,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/historial",
    element: <History />,
  },
  {
    path: "/splash",
    element: <Splash />,
  },
  {
    path: "/personal-data",
    Component: Main,
  },
  {
    path: "/context",
    Component: Main,
  },
  {
    path: "/activity",
    Component: Main,
  },
  {
    path: "/bank",
    Component: Main,
  },
  {
    path: "/expenses-fixed",
    Component: Main,
  },
  {
    path: "/expenses-services",
    Component: Main,
  },
  {
    path: "/habits",
    Component: Main,
  },
  {
    path: "/goals",
    Component: Main,
  },
  {
    path: "/ai-reasoning",
    Component: Main,
  },
  {
    path: "/result",
    Component: Main,
  },
]);
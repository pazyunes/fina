import { createBrowserRouter, Navigate } from "react-router";
import { ResetPassword } from "./components/ResetPassword";
import { RootRedirect } from "./components/RootRedirect";
import { OnboardingV2 } from "./components/onboarding-v2/OnboardingV2";
import { EntrarV2 } from "./components/onboarding-v2/EntrarV2";
import { V2Layout } from "./components/onboarding-v2/V2Layout";
import { HomeV2 } from "./components/onboarding-v2/HomeV2";
import { GastosV2 } from "./components/onboarding-v2/GastosV2";
import { ObjetivosV2 } from "./components/onboarding-v2/ObjetivosV2";
import { InversionesV2 } from "./components/onboarding-v2/InversionesV2";
import { PerfilV2 } from "./components/onboarding-v2/PerfilV2";
import { GruposV2 } from "./components/onboarding-v2/GruposV2";
import { FiniPlayground } from "./components/onboarding-v2/FiniPlayground";

// Las direcciones de la app VIEJA llevan a su equivalente en la nueva. Siguen
// existiendo porque alguien puede tenerlas guardadas (un acceso directo en el
// celular, un link viejo): en vez de mostrarle la versión anterior o una
// pantalla vacía, se la manda al lugar que corresponde. Las pantallas nuevas
// piden sesión solas (V2Layout), así que no hace falta chequearla acá.
const V2 = {
  inicio: "/",
  entrar: "/onboarding-v2/entrar",
  home: "/onboarding-v2/home",
  gastos: "/onboarding-v2/gastos",
  objetivos: "/onboarding-v2/objetivos",
  inversiones: "/onboarding-v2/inversiones",
  perfil: "/onboarding-v2/perfil",
};

const REDIRECCIONES: [string, string][] = [
  ["/login", V2.entrar],
  ["/perfil", V2.perfil],
  // El informe y sus pestañas.
  ["/result", V2.home],
  ["/loading", V2.home],
  ["/ai-reasoning", V2.home],
  ["/objetivos", V2.objetivos],
  ["/inversiones", V2.inversiones],
  // Editar datos desde el perfil viejo.
  ["/editar/ingresos", V2.perfil],
  ["/editar/finanzas", V2.perfil],
  ["/editar/preferencias", V2.perfil],
  ["/editar/gastos-fijos", V2.gastos],
  ["/editar/gastos-variables", V2.gastos],
  ["/editar/objetivos", V2.objetivos],
  // Los pasos del onboarding viejo: al inicio, que decide si va al onboarding
  // nuevo (sin sesión) o a Home (con sesión).
  ...["/personal-data", "/context", "/activity", "/bank", "/expenses-fixed", "/expenses-services", "/habits", "/goals", "/preferencias"]
    .map((viejo): [string, string] => [viejo, V2.inicio]),
];

export const router = createBrowserRouter([
  {
    // PR6 — `/` decide qué mostrar según sesión + hasReport.
    path: "/",
    element: <RootRedirect />,
  },
  {
    // Onboarding real: es la puerta de entrada a FINA. Es público a propósito
    // (todavía no hay cuenta cuando arranca) y crea la cuenta en el último
    // paso. Todo lo que se contesta acá se guarda en Supabase.
    path: "/onboarding-v2",
    element: <OnboardingV2 />,
  },
  {
    // Entrar con una cuenta que ya existe. El `/login` viejo redirige acá.
    path: "/onboarding-v2/entrar",
    element: <EntrarV2 />,
  },
  {
    // Post-onboarding: Home / Gastos / Objetivos / Inversiones / Perfil /
    // Grupos. Piden sesión: V2Layout tiene la puerta, y sin
    // `auth.uid()` las policies de Supabase no devuelven ni una fila.
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
    // PRUEBA (rama prueba/fini) — banco de pruebas del personaje. Fuera del
    // V2Layout a propósito: no lleva menú, es una pantalla de taller.
    path: "/onboarding-v2/fini",
    element: <FiniPlayground />,
  },
  {
    // Pública: llega desde el link del mail de recuperación (sesión de recovery).
    path: "/reset-password",
    element: <ResetPassword />,
  },
  ...REDIRECCIONES.map(([path, destino]) => ({
    path,
    element: <Navigate to={destino} replace />,
  })),
  {
    // Cualquier otra dirección que no existe: al inicio, en vez de una
    // pantalla de error.
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
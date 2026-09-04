import { Outlet } from 'react-router';
import { BottomNavV2 } from './BottomNavV2';
import { SidebarV2 } from './SidebarV2';
import { COLORS } from './shared';

// REDISEÑO v2 — layout compartido por Home/Gastos/Objetivos/Inversiones.
// RESPONSIVE:
//   - Mobile: pantalla completa + menú abajo (BottomNavV2). El contenido lleva
//     padding-bottom para que la última tarjeta no quede tapada por el botón
//     flotante del chat.
//   - Desktop (lg+): menú LATERAL (SidebarV2) a la izquierda + contenido ancho
//     centrado. Se deja atrás el "marco de teléfono". El menú de abajo se oculta.
export function V2Layout() {
  return (
    <div
      className="h-screen supports-[height:100dvh]:h-[100dvh] w-full flex flex-col lg:flex-row overflow-hidden"
      style={{ background: COLORS.paper }}
    >
      {/* Menú lateral — solo desktop */}
      <SidebarV2 />

      {/* Contenido */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full lg:max-w-2xl pb-10 lg:pb-12">
          <Outlet />
        </div>
      </div>

      {/* Menú de abajo — solo mobile */}
      <div className="lg:hidden shrink-0">
        <BottomNavV2 />
      </div>
    </div>
  );
}

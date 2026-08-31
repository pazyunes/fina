import { Outlet } from 'react-router';
import { BottomNavV2 } from './BottomNavV2';
import { COLORS } from './shared';

// REDISEÑO v2 — layout compartido por Home/Gastos/Objetivos/Inversiones:
// el contenido cambia (Outlet), el menú de abajo se queda fijo.
export function V2Layout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.paper }}>
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomNavV2 />
    </div>
  );
}

import { Outlet } from 'react-router';
import { BottomNavV2 } from './BottomNavV2';
import { DeviceFrame } from './shared';

// REDISEÑO v2 — layout compartido por Home/Gastos/Objetivos/Inversiones:
// el contenido cambia (Outlet), el menú de abajo se queda fijo dentro del
// mismo marco (ver DeviceFrame — mobile-first: en mobile es la pantalla
// completa, en desktop es una tarjeta con alto fijo tipo celular).
export function V2Layout() {
  return (
    <DeviceFrame>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </div>
      <BottomNavV2 />
    </DeviceFrame>
  );
}

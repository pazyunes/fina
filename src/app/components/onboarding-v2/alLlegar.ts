import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { AccionPaso } from '../../api/v2/pasos';

// Los botones de "Tu paso de hoy" en Home no llevan a la pantalla general: llevan
// directo a HACER el paso (el formulario del gasto abierto, el tope de la sección
// listo para escribir, la pregunta del nivel…). La pantalla de destino recibe
// qué abrir en el `state` de la navegación y lo abre al llegar.
//
// También se acepta en la dirección (`?abrir=aporte_objetivo`): así llegan los
// avisos del celular, que abren una URL y no pueden pasar `state`.
//
// Se limpia enseguida: volver atrás o recargar no tiene que abrirlo otra vez.

export function useAlLlegar(accion: AccionPaso, hacer: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const estado = location.state as ({ abrir?: string } & Record<string, unknown>) | null;
    const query = new URLSearchParams(location.search);
    if (estado?.abrir !== accion && query.get('abrir') !== accion) return;
    const { abrir: _abrir, ...resto } = estado ?? {};
    query.delete('abrir');
    const busqueda = query.toString();
    navigate(`${location.pathname}${busqueda ? `?${busqueda}` : ''}`, { replace: true, state: Object.keys(resto).length ? resto : null });
    hacer();
    // Sólo cuando se llega con una navegación nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
}

/**
 * Lleva la vista hasta un elemento y le da el foco.
 *
 * Con una espera corta a propósito: el elemento suele aparecer recién en el
 * render que dispara la acción, y el layout sube el scroll arriba del todo al
 * cambiar de pantalla — si se hiciera en el acto, ese scroll lo taparía.
 */
export function llevarA(buscar: () => HTMLElement | null | undefined, enfocar?: () => HTMLElement | null | undefined) {
  window.setTimeout(() => {
    const el = buscar();
    if (!el) return;
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reducir ? 'auto' : 'smooth' });
    (enfocar?.() ?? null)?.focus({ preventScroll: true });
  }, 120);
}

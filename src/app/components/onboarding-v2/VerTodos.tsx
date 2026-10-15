import { COLORS } from './shared';
import { IconChevron } from './FinaIcons';

// "Mostrar menos" (frontend.md §3.5): una lista larga muestra los primeros
// ítems y una fila "Ver todos (N)" que la despliega, como en Mercado Pago.
// Mismo límite y misma fila en todas las listas, para que se lean igual.

/** Cuántos ítems muestra una lista antes de pedir "Ver todos". */
export const LIMITE_LISTA = 5;

/** Los primeros `LIMITE_LISTA`, o todos si la lista está abierta. */
export function recortar<T>(items: T[], abierta: boolean): T[] {
  return abierta ? items : items.slice(0, LIMITE_LISTA);
}

/** La fila que abre y cierra la lista. No se muestra si no hay nada escondido. */
export function VerTodos({ total, abierta, onToggle }: { total: number; abierta: boolean; onToggle: () => void }) {
  if (total <= LIMITE_LISTA) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={abierta}
      className="v2-focus w-full flex items-center justify-between min-h-[48px] py-2 text-[14px] font-semibold rounded-xl"
      style={{ color: COLORS.brand }}
    >
      <span>{abierta ? 'Ver menos' : `Ver todos (${total})`}</span>
      <IconChevron size={16} style={{ transform: abierta ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
    </button>
  );
}

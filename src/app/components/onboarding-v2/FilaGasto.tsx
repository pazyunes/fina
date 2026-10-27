import { COLORS, fechaDisplay } from './shared';
import * as acciones from '../../api/v2/acciones';
import { IconBasura, IconEditar } from './FinaIcons';
import { FormularioGasto } from './FormularioGasto';
import { Hoja } from './Hoja';
import { colorDeSeccion, fmtGasto, fmtPagos, type Categoria, type Gasto } from './datosGasto';

// La fila de un gasto, con editar y borrar. La usan Gastos (los últimos 5) y
// Todos tus gastos (la lista completa). Editar y borrar se abren en una hoja
// aparte, encima de la pantalla (CLAUDE.md regla 12): desplegados debajo del
// renglón empujaban el resto de la lista y no se sabía dónde terminaban.

// Borrar pide confirmación: no se puede deshacer, y el tachito está al lado
// del monto, donde un toque de más es fácil.
function ConfirmarBorrado({ gasto, onCancelar }: { gasto: Gasto; onCancelar: () => void }) {
  return (
    <div className="pt-1 flex flex-col gap-3">
      <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>
        {gasto.descripcion}, <span className="font-mono tabular-nums">{fmtGasto(gasto)}</span>.
        {gasto.pagos?.length ? ` La plata vuelve a ${fmtPagos(gasto.pagos)}.` : gasto.metodoPago ? ` La plata vuelve a ${gasto.metodoPago}.` : ''}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancelar}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold"
          style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { onCancelar(); acciones.borrarGasto(gasto.id); }}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95"
          style={{ background: COLORS.ink, color: COLORS.paper }}
        >
          Sí, borrar
        </button>
      </div>
    </div>
  );
}

/**
 * Un gasto como renglón: el punto y el nombre de su sección (no el tipo: la
 * sección es lo que dice en qué se fue), la fecha y el monto. Todos se pueden
 * editar y borrar, también los que llegaron por WhatsApp. `abierto` dice qué
 * hoja tiene abierta: ninguna, la de editar o la de borrar. Una a la vez en
 * toda la lista: lo controla la pantalla.
 */
export function FilaGasto({ gasto, categorias, abierto, onAbrir }: {
  gasto: Gasto;
  categorias: Categoria[];
  abierto: 'editar' | 'borrar' | null;
  onAbrir: (que: 'editar' | 'borrar' | null) => void;
}) {
  const cat = categorias.find((c) => c.id === gasto.categoriaId);
  return (
    <div className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorDeSeccion(gasto.categoriaId, categorias) }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] truncate" style={{ color: COLORS.ink }}>{gasto.descripcion}</p>
          <p className="text-[13px] truncate" style={{ color: COLORS.inkSoft }}>
            {cat?.nombre ?? 'Sin categoría'}, {fechaDisplay(gasto.ts).toLowerCase()}
          </p>
        </div>
        <span className="font-mono tabular-nums text-[14px] shrink-0" style={{ color: COLORS.ink }}>{fmtGasto(gasto)}</span>
        <button
          type="button"
          onClick={() => onAbrir('editar')}
          aria-label={`Editar ${gasto.descripcion}`}
          aria-haspopup="dialog"
          className="v2-focus w-11 h-11 -my-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
          style={{ color: COLORS.inkFaint }}
        >
          <IconEditar size={18} />
        </button>
        <button
          type="button"
          onClick={() => onAbrir('borrar')}
          aria-label={`Borrar ${gasto.descripcion}`}
          aria-haspopup="dialog"
          className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
          style={{ color: COLORS.inkFaint }}
        >
          <IconBasura size={18} />
        </button>
      </div>
      {abierto === 'editar' && (
        <Hoja titulo="Editar gasto" onCerrar={() => onAbrir(null)}>
          <FormularioGasto gasto={gasto} categorias={categorias} onListo={() => onAbrir(null)} onCancelar={() => onAbrir(null)} />
        </Hoja>
      )}
      {abierto === 'borrar' && (
        <Hoja titulo="¿Borrar este gasto?" onCerrar={() => onAbrir(null)}>
          <ConfirmarBorrado gasto={gasto} onCancelar={() => onAbrir(null)} />
        </Hoja>
      )}
    </div>
  );
}

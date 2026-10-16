import { COLORS, fechaDisplay, fmtMoney } from './shared';
import * as acciones from '../../api/v2/acciones';
import { IconBasura, IconEditar } from './FinaIcons';
import type { EstadoV2, PagoMixto } from '../../api/v2/tipos';

// La fila de un gasto y lo que la rodea (editar, borrar, el color de su
// sección). Vive aparte porque la usan dos pantallas: Gastos, con los últimos
// del período, y Todos tus gastos, con la lista completa.

export type TipoGasto = 'urgente' | 'impulsivo' | 'necesario' | 'otro';
export type Moneda = 'ARS' | 'USD';
export type Categoria = { id: string; nombre: string };
export type Gasto = { id: string; monto: number; montoArs: number; moneda: Moneda; descripcion: string; categoriaId: string; tipo: TipoGasto; tipoOtro?: string; ts: number; metodoPago?: string; pagos?: PagoMixto[]; origen: 'web' | 'whatsapp' | 'manual' };

/**
 * Los gastos del almacén como los muestra la app. Si un gasto llegó sin
 * descripción, o con una variable sin completar del bot
 * ("{{vars.expense_description}}"), se muestra el nombre de la sección: un
 * renglón vacío o con código no dice qué gasto es.
 */
export function gastosDeLaBase(db: EstadoV2): Gasto[] {
  return db.gastos.map((g) => ({
    id: g.id,
    monto: g.monto,
    montoArs: g.montoArs,
    moneda: g.moneda,
    descripcion: !g.descripcion.trim() || /\{\{.*\}\}/.test(g.descripcion)
      ? (db.secciones.find((s) => s.id === g.seccionId)?.nombre ?? 'Gasto sin descripción')
      : g.descripcion,
    categoriaId: g.seccionId ?? '',
    tipo: g.tipo,
    tipoOtro: g.tipoOtro,
    ts: g.ts,
    metodoPago: g.metodoPago ?? undefined,
    pagos: g.pagos,
    origen: g.origen,
  }));
}

// Hues categóricos por sección, para el anillo, la torta de Inicio y el punto
// de cada gasto. Los montos nunca toman estos colores: siempre tinta neutral.
// Seis colores bien distintos entre sí: con violetas parecidos, con seis
// secciones la mitad de la rueda terminaba emparentada.
const CAT_COLORS = [COLORS.brand, COLORS.naranja, COLORS.star, COLORS.lima, COLORS.azul, COLORS.magenta];

/** El color de una sección, atado al orden en que se creó: no cambia si cambia lo gastado. */
export function colorDeSeccion(id: string, categorias: Categoria[]): string {
  const i = categorias.findIndex((c) => c.id === id);
  return i < 0 ? COLORS.lineStrong : CAT_COLORS[i % CAT_COLORS.length];
}

// Cada gasto guarda DOS montos: `monto` es lo que la persona tipeó, en su
// moneda, y `montoArs` su equivalente en pesos congelado a la cotización de
// ese día. La fila muestra `monto` con su signo (US$20, porque eso es lo que
// pasó); todo lo que SUMA usa `montoArs`.
export function fmtGasto(g: { monto: number; moneda: Moneda }): string {
  return g.moneda === 'USD' ? `US$${g.monto.toLocaleString('es-AR')}` : fmtMoney(g.monto);
}
export function fmtPagos(pagos: PagoMixto[]): string {
  return pagos.map((p) => `${p.medio} (${fmtMoney(p.monto)})`).join(' + ');
}

// Borrar pide confirmación en el mismo renglón: no se puede deshacer, y el
// tachito está al lado del monto, donde un toque de más es fácil.
function BotonBorrar({ gasto, abierto, onClick }: { gasto: Gasto; abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Borrar ${gasto.descripcion}`}
      aria-expanded={abierto}
      className="v2-focus w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
      style={{ color: abierto ? COLORS.ink : COLORS.inkFaint }}
    >
      <IconBasura size={18} />
    </button>
  );
}

function BotonEditar({ gasto, onClick }: { gasto: Gasto; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${gasto.descripcion}`}
      className="v2-focus w-11 h-11 -my-2 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
      style={{ color: COLORS.inkFaint }}
    >
      <IconEditar size={18} />
    </button>
  );
}

function ConfirmarBorrado({ gasto, onCancelar }: { gasto: Gasto; onCancelar: () => void }) {
  return (
    <div className="mt-2 mb-1 rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado">
      <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
        ¿Borrar "{gasto.descripcion}" de <span className="font-mono tabular-nums">{fmtGasto(gasto)}</span>?
        {gasto.pagos?.length ? ` La plata vuelve a ${fmtPagos(gasto.pagos)}.` : gasto.metodoPago ? ` La plata vuelve a ${gasto.metodoPago}.` : ''}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancelar}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold"
          style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { onCancelar(); acciones.borrarGasto(gasto.id); }}
          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold transition-all duration-100 active:scale-95"
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
 * sección es lo que dice en qué se fue), la fecha, el monto, editar y borrar.
 * Todos se pueden editar y borrar, también los que llegaron por WhatsApp.
 */
export function FilaGasto({ gasto, categorias, borrando, onBorrar, onEditar }: {
  gasto: Gasto;
  categorias: Categoria[];
  borrando: boolean;
  onBorrar: () => void;
  onEditar: () => void;
}) {
  const cat = categorias.find((c) => c.id === gasto.categoriaId);
  return (
    <div className="py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorDeSeccion(gasto.categoriaId, categorias) }} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] truncate" style={{ color: COLORS.ink }}>{gasto.descripcion}</p>
          <p className="text-[14px] truncate" style={{ color: COLORS.inkSoft }}>
            {cat?.nombre ?? 'Sin sección'}, {fechaDisplay(gasto.ts).toLowerCase()}
          </p>
        </div>
        <span className="font-mono tabular-nums text-[15px] shrink-0" style={{ color: COLORS.ink }}>{fmtGasto(gasto)}</span>
        <BotonEditar gasto={gasto} onClick={onEditar} />
        <BotonBorrar gasto={gasto} abierto={borrando} onClick={onBorrar} />
      </div>
      {borrando && <ConfirmarBorrado gasto={gasto} onCancelar={onBorrar} />}
    </div>
  );
}

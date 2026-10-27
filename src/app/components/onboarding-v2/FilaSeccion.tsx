import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BORDE_FALTA, COLORS, Monto, SegmentedTab, TextoFalta, formatThousands, parseMoneyInput } from './shared';
import { useFaltantes } from './useFaltantes';
import * as acciones from '../../api/v2/acciones';
import { IconBasura, IconChevron, IconEditar } from './FinaIcons';
import { FilaGasto } from './FilaGasto';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { INPUT_STYLE } from './FormularioGasto';
import { gastosDeLaBase, seccionesDeLaBase, type Categoria, type Periodo, type Tope } from './datosGasto';

// Una sección como renglón: su color, el nombre, lo gastado y el tope. La usan
// Gastos (las 5 donde más se gastó) y Tus secciones (todas). Tocar la fila
// despliega sus 3 gastos más recientes, con "Ver más" para ir a la pantalla con
// todos los de esa categoría, y ahí mismo "Agregar tope" (o "Editar tope") abre
// el campo del tope; al guardar, se vuelve a cerrar.
//
// `conEdicion` suma renombrar y borrar, que sólo están en Tus secciones: en
// Gastos se ponen topes, no se reorganizan secciones.

export function FilaSeccion({ cat, color, gastado, referencia, tope, cantGastos, abierta, onAbrir, conEdicion = false }: {
  cat: Categoria;
  color: string;
  gastado: number;
  /** El período de lo gastado, en minúscula: "este mes", "en septiembre". */
  referencia: string;
  tope: Tope | undefined;
  cantGastos: number;
  abierta: boolean;
  onAbrir: (abrir: boolean) => void;
  conEdicion?: boolean;
}) {
  const [monto, setMonto] = useState(() => (tope ? formatThousands(String(tope.monto)) : ''));
  const [periodo, setPeriodo] = useState<Periodo>(tope?.periodo ?? 'semana');
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(cat.nombre);
  const [borrando, setBorrando] = useState(false);
  const navigate = useNavigate();
  const { estado: db } = useAlmacen();
  const [desplegada, setDesplegada] = useState(false);
  const [gastoAbierto, setGastoAbierto] = useState<{ id: string; que: 'editar' | 'borrar' } | null>(null);
  const { categorias, delaSeccion } = useMemo(() => ({
    categorias: seccionesDeLaBase(db).categorias,
    delaSeccion: gastosDeLaBase(db).filter((g) => g.categoriaId === cat.id).sort((a, b) => b.ts - a.ts),
  }), [db, cat.id]);
  // Con el campo del tope abierto (por ejemplo, venido de Inicio) la fila se ve desplegada.
  const visible = desplegada || abierta;
  const alternar = () => { if (visible) { setDesplegada(false); setGastoAbierto(null); onAbrir(false); } else setDesplegada(true); };
  const faltaTope = useFaltantes({ monto: parseMoneyInput(monto) <= 0 }, abierta);
  const faltaNombre = useFaltantes({ nombre: !nombre.trim() }, renombrando);

  function guardarTope() {
    faltaTope.intentar(() => {
      acciones.guardarTope(cat.id, { monto: parseMoneyInput(monto), periodo });
      onAbrir(false);
    });
  }
  function guardarNombre() {
    faltaNombre.intentar(() => {
      acciones.renombrarSeccion(cat.id, nombre.trim());
      setRenombrando(false);
    });
  }

  return (
    <div data-seccion={cat.id} className="py-3.5 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      {renombrando ? (
        <div ref={faltaNombre.ref} className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              autoFocus
              data-campo="nombre"
              aria-label={`Nuevo nombre para ${cat.nombre}`}
              aria-invalid={faltaNombre.marcado('nombre') || undefined}
              maxLength={40}
              className="v2-focus flex-1 min-w-0 rounded-xl px-3 min-h-[44px] text-[14px]"
              style={{ ...INPUT_STYLE, ...(faltaNombre.marcado('nombre') ? { border: BORDE_FALTA } : {}) }}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardarNombre();
                if (e.key === 'Escape') { setNombre(cat.nombre); setRenombrando(false); }
              }}
            />
            <button type="button" onClick={guardarNombre} className="v2-focus rounded-xl px-4 min-h-[44px] text-[13px] font-bold" style={{ background: COLORS.brand, color: COLORS.surface }}>
              Guardar
            </button>
            <button type="button" onClick={() => { setNombre(cat.nombre); setRenombrando(false); }} className="v2-focus rounded-xl px-3 min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
              Cancelar
            </button>
          </div>
          {faltaNombre.marcado('nombre') && <TextoFalta>Falta el nombre.</TextoFalta>}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={visible}
            onClick={alternar}
            className="v2-focus flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl min-h-[44px]"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[14px] truncate" style={{ color: COLORS.ink }}>{cat.nombre}</span>
              {/* Todo número lleva referencia (§5.4): de qué período es. */}
              <span className="block text-[13px] truncate" style={{ color: COLORS.inkSoft }}>
                <Monto value={gastado} className="text-[13px]" /> {referencia}
              </span>
            </span>
          </button>
          {/* El tope, al costado: se pone sin tener que abrir la categoría. */}
          <button
            type="button"
            onClick={() => { setDesplegada(true); onAbrir(!abierta); }}
            className="v2-focus shrink-0 min-h-[44px] text-[13px] font-semibold"
            style={{ color: COLORS.brand }}
          >
            {tope ? 'Editar tope' : 'Agregar tope'}
          </button>
          <button
            type="button"
            onClick={alternar}
            aria-label={visible ? `Ocultar los gastos de ${cat.nombre}` : `Ver los gastos de ${cat.nombre}`}
            aria-expanded={visible}
            className="v2-focus w-9 h-11 -mr-2 flex items-center justify-center shrink-0"
            style={{ color: COLORS.inkFaint }}
          >
            <IconChevron size={16} style={{ transform: visible ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
          {conEdicion && (
            <>
              <button
                type="button"
                onClick={() => { setNombre(cat.nombre); setRenombrando(true); setBorrando(false); setDesplegada(false); onAbrir(false); }}
                aria-label={`Renombrar ${cat.nombre}`}
                className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ color: COLORS.inkFaint }}
              >
                <IconEditar size={18} />
              </button>
              <button
                type="button"
                onClick={() => { setBorrando((v) => !v); setDesplegada(false); onAbrir(false); }}
                aria-label={`Borrar la categoría ${cat.nombre}`}
                aria-expanded={borrando}
                className="v2-focus w-11 h-11 -mr-2 rounded-full flex items-center justify-center shrink-0"
                style={{ color: borrando ? COLORS.ink : COLORS.inkFaint }}
              >
                <IconBasura size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Barra de tope: llega hasta 100% y no más. Un tope excedido NO se pinta
          de alerta, sigue en el hue de la sección (§3.3). */}
      {tope && !abierta && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min((gastado / tope.monto) * 100, 100)}%`, background: color }} />
          </div>
          <span className="flex items-center gap-1 text-[13px]" style={{ color: COLORS.inkSoft }}>
            Tope: <Monto value={tope.monto} className="text-[13px]" />/{tope.periodo === 'semana' ? 'sem' : 'mes'}
          </span>
        </div>
      )}

      {visible && !renombrando && (
        <div className="flex flex-col pl-6">
          {delaSeccion.length === 0
            ? <p className="py-2 text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no hay gastos en esta categoría.</p>
            : delaSeccion.slice(0, 3).map((g) => (
              <FilaGasto
                key={g.id}
                gasto={g}
                categorias={categorias}
                abierto={gastoAbierto?.id === g.id ? gastoAbierto.que : null}
                onAbrir={(que) => setGastoAbierto(que ? { id: g.id, que } : null)}
              />
            ))}
          <div className="flex items-center justify-between gap-3">
            {delaSeccion.length > 3 ? (
              <button
                type="button"
                onClick={() => navigate(`/onboarding-v2/gastos/categoria/${cat.id}`)}
                className="v2-focus min-h-[44px] text-[13px] font-semibold underline"
                style={{ color: COLORS.brand }}
              >
                Ver más
              </button>
            ) : <span />}
          </div>
        </div>
      )}

      {abierta && (
        <div ref={faltaTope.ref} className="flex flex-col gap-2 pt-1">
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              autoFocus
              aria-label={`Tope de ${cat.nombre}`}
              aria-invalid={faltaTope.marcado('monto') || undefined}
              data-tope-de={cat.id}
              data-campo="monto"
              className="v2-focus w-full rounded-xl pl-7 pr-3 py-2 min-h-[44px] text-[13px] transition-colors"
              style={{ ...INPUT_STYLE, ...(faltaTope.marcado('monto') ? { border: BORDE_FALTA } : {}) }}
              placeholder="Monto"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(formatThousands(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') guardarTope(); }}
            />
          </div>
          {faltaTope.marcado('monto') && <TextoFalta>Falta el monto del tope.</TextoFalta>}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <SegmentedTab
                options={[{ id: 'semana' as Periodo, label: 'Por semana' }, { id: 'mes' as Periodo, label: 'Por mes' }]}
                value={periodo}
                onChange={setPeriodo}
                trackColor={COLORS.tint}
              />
            </div>
            <button
              type="button"
              className="v2-focus rounded-xl px-3.5 py-2.5 min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95 shrink-0"
              style={{ background: COLORS.brand, color: COLORS.surface }}
              onClick={guardarTope}
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {borrando && (
        <div className="rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado de la categoría">
          <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>
            ¿Borrar la categoría "{cat.nombre}"?
            {cantGastos > 0
              ? (cantGastos === 1 ? ' Su gasto queda sin categoría.' : ` Sus ${cantGastos} gastos quedan sin categoría.`)
              : ' No tiene gastos.'}
          </p>
          <div className="flex gap-2">
            <button type="button" autoFocus onClick={() => setBorrando(false)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { setBorrando(false); acciones.borrarSeccion(cat.id); }}
              className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-bold"
              style={{ background: COLORS.ink, color: COLORS.paper }}
            >
              Sí, borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

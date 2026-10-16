import { useState } from 'react';
import { COLORS, Monto, SegmentedTab, formatThousands, parseMoneyInput } from './shared';
import * as acciones from '../../api/v2/acciones';
import { IconBasura, IconEditar } from './FinaIcons';
import { INPUT_STYLE } from './FormularioGasto';
import type { Categoria, Periodo, Tope } from './datosGasto';

// Una sección como renglón: su color, el nombre, lo gastado y el tope. La usan
// Gastos (las 5 donde más se gastó) y Tus secciones (todas). Tocar la fila o
// el botón del tope hacen lo mismo, abrir el campo del tope, así que no hay
// flecha aparte; al guardar, se vuelve a cerrar.
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

  function guardarTope() {
    const n = parseMoneyInput(monto);
    if (n <= 0) return;
    acciones.guardarTope(cat.id, { monto: n, periodo });
    onAbrir(false);
  }
  function guardarNombre() {
    if (!nombre.trim()) return;
    acciones.renombrarSeccion(cat.id, nombre.trim());
    setRenombrando(false);
  }

  return (
    <div data-seccion={cat.id} className="py-3.5 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      {renombrando ? (
        <div className="flex gap-2">
          <input
            autoFocus
            aria-label={`Nuevo nombre para ${cat.nombre}`}
            maxLength={40}
            className="v2-focus flex-1 min-w-0 rounded-xl px-3 min-h-[44px] text-[15px]"
            style={INPUT_STYLE}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarNombre();
              if (e.key === 'Escape') { setNombre(cat.nombre); setRenombrando(false); }
            }}
          />
          <button type="button" disabled={!nombre.trim()} onClick={guardarNombre} className="v2-focus rounded-xl px-4 min-h-[44px] text-[14px] font-bold v2-disabled" style={{ background: COLORS.brand, color: COLORS.surface }}>
            Guardar
          </button>
          <button type="button" onClick={() => { setNombre(cat.nombre); setRenombrando(false); }} className="v2-focus rounded-xl px-3 min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={abierta}
            onClick={() => onAbrir(!abierta)}
            className="v2-focus flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl min-h-[44px]"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px] truncate" style={{ color: COLORS.ink }}>{cat.nombre}</span>
              {/* Todo número lleva referencia (§5.4): de qué período es. */}
              <span className="block text-[14px] truncate" style={{ color: COLORS.inkSoft }}>
                <Monto value={gastado} className="text-[14px]" /> {referencia}
              </span>
            </span>
            <span className="shrink-0 text-[14px] font-semibold" style={{ color: COLORS.brand }}>
              {tope ? 'Editar tope' : 'Agregar tope'}
            </span>
          </button>
          {conEdicion && (
            <>
              <button
                type="button"
                onClick={() => { setNombre(cat.nombre); setRenombrando(true); setBorrando(false); onAbrir(false); }}
                aria-label={`Renombrar ${cat.nombre}`}
                className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ color: COLORS.inkFaint }}
              >
                <IconEditar size={18} />
              </button>
              <button
                type="button"
                onClick={() => { setBorrando((v) => !v); onAbrir(false); }}
                aria-label={`Borrar la sección ${cat.nombre}`}
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
          <span className="flex items-center gap-1 text-[14px]" style={{ color: COLORS.inkSoft }}>
            Tope: <Monto value={tope.monto} className="text-[14px]" />/{tope.periodo === 'semana' ? 'sem' : 'mes'}
          </span>
        </div>
      )}

      {abierta && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              autoFocus
              aria-label={`Tope de ${cat.nombre}`}
              data-tope-de={cat.id}
              className="v2-focus w-full rounded-xl pl-7 pr-3 py-2 min-h-[44px] text-[14px] transition-colors"
              style={INPUT_STYLE}
              placeholder="Monto"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(formatThousands(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') guardarTope(); }}
            />
          </div>
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
              disabled={parseMoneyInput(monto) <= 0}
              className="v2-focus rounded-xl px-3.5 py-2.5 min-h-[44px] text-[14px] font-bold v2-disabled transition-all duration-100 active:scale-95 shrink-0"
              style={{ background: COLORS.brand, color: COLORS.surface }}
              onClick={guardarTope}
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {borrando && (
        <div className="rounded-xl px-3.5 py-3 flex flex-col gap-2.5" style={{ background: COLORS.tint }} role="group" aria-label="Confirmar borrado de la sección">
          <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
            ¿Borrar la sección "{cat.nombre}"?
            {cantGastos > 0
              ? ` Sus ${cantGastos} ${cantGastos === 1 ? 'gasto no se borra' : 'gastos no se borran'}: ${cantGastos === 1 ? 'queda' : 'quedan'} sin sección.`
              : ' No tiene gastos.'}
          </p>
          <div className="flex gap-2">
            <button type="button" autoFocus onClick={() => setBorrando(false)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { setBorrando(false); acciones.borrarSeccion(cat.id); }}
              className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold"
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

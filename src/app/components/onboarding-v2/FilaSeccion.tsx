import { useState } from 'react';
import { BORDE_FALTA, COLORS, Monto, SegmentedTab, TextoFalta, formatThousands, parseMoneyInput } from './shared';
import { useFaltantes } from './useFaltantes';
import * as acciones from '../../api/v2/acciones';
import { IconBasura, IconEditar } from './FinaIcons';
import { INPUT_STYLE } from './FormularioGasto';
import { Hoja } from './Hoja';
import type { Categoria, Periodo, Tope } from './datosGasto';

// Una sección como renglón: su color, el nombre, lo gastado y el tope. La usan
// Gastos (las 5 con gastos más recientes) y Tus secciones (todas). Tocar la
// fila o el botón del tope hacen lo mismo, abrir el tope, así que no hay flecha
// aparte.
//
// `conEdicion` suma renombrar y borrar, que sólo están en Tus secciones: en
// Gastos se ponen topes, no se reorganizan secciones.
//
// El tope, renombrar y borrar se abren en una hoja aparte, encima de la
// pantalla (CLAUDE.md regla 12). Cada hoja arranca con lo que está guardado:
// al cerrarla sin guardar, lo que se escribió se descarta.

const BOTON_CANCELAR: React.CSSProperties = { color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface };

function EditorTope({ cat, tope, onListo }: { cat: Categoria; tope: Tope | undefined; onListo: () => void }) {
  const [monto, setMonto] = useState(() => (tope ? formatThousands(String(tope.monto)) : ''));
  const [periodo, setPeriodo] = useState<Periodo>(tope?.periodo ?? 'semana');
  const falta = useFaltantes({ monto: parseMoneyInput(monto) <= 0 });

  function guardar() {
    falta.intentar(() => {
      acciones.guardarTope(cat.id, { monto: parseMoneyInput(monto), periodo });
      onListo();
    });
  }

  return (
    <div ref={falta.ref} className="py-2 flex flex-col gap-3">
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
        <input
          autoFocus
          aria-label={`Tope de ${cat.nombre}`}
          aria-invalid={falta.marcado('monto') || undefined}
          data-tope-de={cat.id}
          data-campo="monto"
          className="v2-focus w-full rounded-xl pl-7 pr-3 py-2 min-h-[44px] text-[14px] transition-colors"
          style={{ ...INPUT_STYLE, ...(falta.marcado('monto') ? { border: BORDE_FALTA } : {}) }}
          placeholder="Monto"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(formatThousands(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
        />
      </div>
      {falta.marcado('monto') && <TextoFalta>Falta el monto del tope.</TextoFalta>}
      <SegmentedTab
        options={[{ id: 'semana' as Periodo, label: 'Por semana' }, { id: 'mes' as Periodo, label: 'Por mes' }]}
        value={periodo}
        onChange={setPeriodo}
        trackColor={COLORS.tint}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onListo} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={BOTON_CANCELAR}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          className="v2-focus flex-[2] rounded-xl min-h-[44px] text-[13px] font-bold transition-all duration-100 active:scale-95"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function EditorNombre({ cat, onListo }: { cat: Categoria; onListo: () => void }) {
  const [nombre, setNombre] = useState(cat.nombre);
  const falta = useFaltantes({ nombre: !nombre.trim() });

  function guardar() {
    falta.intentar(() => {
      acciones.renombrarSeccion(cat.id, nombre.trim());
      onListo();
    });
  }

  return (
    <div ref={falta.ref} className="py-2 flex flex-col gap-3">
      <input
        autoFocus
        data-campo="nombre"
        aria-label={`Nuevo nombre para ${cat.nombre}`}
        aria-invalid={falta.marcado('nombre') || undefined}
        maxLength={40}
        className="v2-focus w-full rounded-xl px-3 min-h-[44px] text-[14px]"
        style={{ ...INPUT_STYLE, ...(falta.marcado('nombre') ? { border: BORDE_FALTA } : {}) }}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
      />
      {falta.marcado('nombre') && <TextoFalta>Falta el nombre.</TextoFalta>}
      <div className="flex gap-2">
        <button type="button" onClick={onListo} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={BOTON_CANCELAR}>
          Cancelar
        </button>
        <button type="button" onClick={guardar} className="v2-focus flex-[2] rounded-xl min-h-[44px] text-[13px] font-bold" style={{ background: COLORS.brand, color: COLORS.surface }}>
          Guardar
        </button>
      </div>
    </div>
  );
}

export function FilaSeccion({ cat, color, gastado, referencia, tope, cantGastos, abierta, onAbrir, conEdicion = false }: {
  cat: Categoria;
  color: string;
  gastado: number;
  /** El período de lo gastado, en minúscula: "este mes", "en septiembre". */
  referencia: string;
  tope: Tope | undefined;
  cantGastos: number;
  /** Si la hoja del tope está abierta. */
  abierta: boolean;
  onAbrir: (abrir: boolean) => void;
  conEdicion?: boolean;
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  return (
    <div data-seccion={cat.id} className="py-3.5 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onAbrir(true)}
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
          <span className="shrink-0 text-[13px] font-semibold" style={{ color: COLORS.brand }}>
            {tope ? 'Editar tope' : 'Agregar tope'}
          </span>
        </button>
        {conEdicion && (
          <>
            <button
              type="button"
              onClick={() => { setRenombrando(true); onAbrir(false); }}
              aria-label={`Renombrar ${cat.nombre}`}
              aria-haspopup="dialog"
              className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ color: COLORS.inkFaint }}
            >
              <IconEditar size={18} />
            </button>
            <button
              type="button"
              onClick={() => { setBorrando(true); onAbrir(false); }}
              aria-label={`Borrar la categoría ${cat.nombre}`}
              aria-haspopup="dialog"
              className="v2-focus w-11 h-11 -mr-2 rounded-full flex items-center justify-center shrink-0"
              style={{ color: COLORS.inkFaint }}
            >
              <IconBasura size={18} />
            </button>
          </>
        )}
      </div>

      {/* Barra de tope: llega hasta 100% y no más. Un tope excedido NO se pinta
          de alerta, sigue en el hue de la sección (§3.3). */}
      {tope && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min((gastado / tope.monto) * 100, 100)}%`, background: color }} />
          </div>
          <span className="flex items-center gap-1 text-[13px]" style={{ color: COLORS.inkSoft }}>
            Tope: <Monto value={tope.monto} className="text-[13px]" />/{tope.periodo === 'semana' ? 'sem' : 'mes'}
          </span>
        </div>
      )}

      {abierta && (
        <Hoja titulo={`Tope de ${cat.nombre}`} onCerrar={() => onAbrir(false)}>
          <EditorTope cat={cat} tope={tope} onListo={() => onAbrir(false)} />
        </Hoja>
      )}

      {renombrando && (
        <Hoja titulo="Renombrar categoría" onCerrar={() => setRenombrando(false)}>
          <EditorNombre cat={cat} onListo={() => setRenombrando(false)} />
        </Hoja>
      )}

      {borrando && (
        <Hoja titulo="¿Borrar esta categoría?" onCerrar={() => setBorrando(false)}>
          <div className="pt-1 flex flex-col gap-3">
            <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>
              {cat.nombre}.
              {cantGastos > 0
                ? (cantGastos === 1 ? ' Su gasto queda sin categoría.' : ` Sus ${cantGastos} gastos quedan sin categoría.`)
                : ' No tiene gastos.'}
            </p>
            <div className="flex gap-2">
              <button type="button" autoFocus onClick={() => setBorrando(false)} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={BOTON_CANCELAR}>
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
        </Hoja>
      )}
    </div>
  );
}

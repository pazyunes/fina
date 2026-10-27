import { useState } from 'react';
import { BORDE_FALTA, COLORS, TextoFalta, formatMontoInicial, formatThousands, parseMoneyInput } from './shared';
import { useFaltantes } from './useFaltantes';
import { aInputFecha, deInputFecha } from './FormularioGasto';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { FUENTES_INGRESO, type FuenteIngreso, type Ingreso, type MonedaConvertible } from '../../api/v2/tipos';

// Editar un ingreso, en una hoja aparte (el lapicito, igual que en los gastos;
// CLAUDE.md regla 12). Se puede cambiar el monto y la moneda, de dónde vino (con "otro"
// escribible), en qué medio entró, la descripción y cuándo fue. Cambiar el monto
// o el medio mueve el saldo de los medios: lo resuelve `acciones.editarIngreso`.

const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };

export function EditorIngreso({ ingreso, onCerrar }: { ingreso: Ingreso; onCerrar: () => void }) {
  const { estado } = useAlmacen();
  const [monto, setMonto] = useState(() => formatMontoInicial(ingreso.monto));
  const [moneda, setMoneda] = useState<MonedaConvertible>(ingreso.moneda);
  const [fuente, setFuente] = useState<FuenteIngreso | ''>(ingreso.fuente ?? '');
  const [fuenteOtra, setFuenteOtra] = useState(ingreso.fuenteOtra ?? '');
  // Los medios que ya hay, más el de este ingreso por si ya no figura en la lista.
  const medios = [...new Set([...estado.mediosPago.map((m) => m.nombre), ...(ingreso.medio ? [ingreso.medio] : [])])];
  const [medio, setMedio] = useState(ingreso.medio ?? '');
  const [medioOtro, setMedioOtro] = useState('');
  const [descripcion, setDescripcion] = useState(ingreso.descripcion);
  // Sólo el día, como en los gastos.
  const [fecha, setFecha] = useState(() => aInputFecha(ingreso.ts));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNum = parseMoneyInput(monto);
  const medioFinal = (medio === 'otro' ? medioOtro : medio).trim();
  const faltantes = useFaltantes({ monto: montoNum <= 0 });

  async function guardar() {
    if (montoNum <= 0 || guardando) return;
    setGuardando(true);
    setError(null);
    // Sólo se manda lo que cambió. Sobre todo el monto y la moneda: mandarlos
    // siempre recalcularía a la cotización de HOY un ingreso en dólares viejo
    // con sólo corregirle la descripción.
    const cambioMonto = montoNum !== ingreso.monto || moneda !== ingreso.moneda;
    const r = await acciones.editarIngreso(ingreso.id, {
      monto: cambioMonto ? montoNum : undefined,
      moneda: cambioMonto ? moneda : undefined,
      fuente: fuente || null,
      fuenteOtra,
      descripcion,
      medio: medioFinal && medioFinal !== ingreso.medio ? medioFinal : undefined,
      // La fecha del input no tiene hora: si no se tocó, no se pisa la original.
      ts: fecha === aInputFecha(ingreso.ts) ? undefined : deInputFecha(fecha, ingreso.ts),
    });
    setGuardando(false);
    if (r.error !== null) { setError(r.error); return; }
    onCerrar();
  }

  return (
    <div ref={faltantes.ref} className="py-2 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{moneda === 'USD' ? 'US$' : '$'}</span>
          <input
            autoFocus
            data-campo="monto"
            aria-label="Monto del ingreso"
            aria-invalid={faltantes.marcado('monto') || undefined}
            inputMode="decimal"
            className="v2-focus w-full rounded-xl pl-10 pr-3 py-2.5 text-[14px]"
            style={{ ...INPUT_STYLE, ...(faltantes.marcado('monto') ? { border: BORDE_FALTA } : {}) }}
            value={monto}
            onChange={(e) => setMonto(formatThousands(e.target.value))}
          />
        </div>
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: `1.5px solid ${COLORS.lineStrong}` }}>
          {(['ARS', 'USD'] as MonedaConvertible[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoneda(m)}
              aria-pressed={moneda === m}
              className="v2-focus px-2.5 text-[13px] font-bold"
              style={moneda === m ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      {faltantes.marcado('monto') && <TextoFalta>Falta el monto.</TextoFalta>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`ing-fuente-${ingreso.id}`} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿De dónde vino?</label>
        <select
          id={`ing-fuente-${ingreso.id}`}
          value={fuente}
          onChange={(e) => setFuente(e.target.value as FuenteIngreso | '')}
          className="v2-focus rounded-xl px-3.5 min-h-[48px] text-[14px]"
          style={{ ...INPUT_STYLE, color: fuente ? COLORS.ink : COLORS.inkFaint }}
        >
          <option value="" style={{ color: COLORS.ink }}>Sin especificar</option>
          {FUENTES_INGRESO.map((f) => <option key={f.id} value={f.id} style={{ color: COLORS.ink }}>{f.label}</option>)}
        </select>
        {fuente === 'otro' && (
          <input
            aria-label="De dónde vino la plata, cuál"
            maxLength={40}
            placeholder="Escribí de dónde (ej: Beca, Alquiler)"
            className="v2-focus rounded-xl px-3.5 min-h-[48px] text-[14px]"
            style={INPUT_STYLE}
            value={fuenteOtra}
            onChange={(e) => setFuenteOtra(e.target.value)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`ing-medio-${ingreso.id}`} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>¿Dónde entró?</label>
        <select
          id={`ing-medio-${ingreso.id}`}
          value={medio}
          onChange={(e) => setMedio(e.target.value)}
          className="v2-focus rounded-xl px-3.5 min-h-[48px] text-[14px]"
          style={{ ...INPUT_STYLE, color: medio ? COLORS.ink : COLORS.inkFaint }}
        >
          <option value="" style={{ color: COLORS.ink }}>Elegí un medio</option>
          {medios.map((m) => <option key={m} value={m} style={{ color: COLORS.ink }}>{m}</option>)}
          <option value="otro" style={{ color: COLORS.ink }}>+ Otro medio</option>
        </select>
        {medio === 'otro' && (
          <input
            aria-label="En qué medio entró, cuál"
            placeholder="Ej: Ualá"
            className="v2-focus rounded-xl px-3.5 min-h-[48px] text-[14px]"
            style={INPUT_STYLE}
            value={medioOtro}
            onChange={(e) => setMedioOtro(e.target.value)}
          />
        )}
      </div>

      <input
        aria-label="Descripción del ingreso"
        placeholder="Descripción (opcional)"
        className="v2-focus rounded-xl px-3.5 py-2.5 text-[14px]"
        style={INPUT_STYLE}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`ing-fecha-${ingreso.id}`} className="text-[13px] font-bold" style={{ color: COLORS.inkSoft }}>Fecha</label>
        <input
          id={`ing-fecha-${ingreso.id}`}
          type="date"
          className="v2-focus w-full min-w-0 rounded-xl px-3.5 min-h-[48px] text-[14px]"
          style={INPUT_STYLE}
          value={fecha}
          max={aInputFecha(Date.now())}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {error && <p role="alert" className="text-[13px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCerrar} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[13px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => faltantes.intentar(() => void guardar())}
          disabled={guardando}
          className="v2-focus flex-[2] rounded-xl min-h-[44px] text-[13px] font-bold v2-disabled"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

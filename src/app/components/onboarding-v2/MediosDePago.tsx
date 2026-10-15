import { useState } from 'react';
import { COLORS } from './shared';
import { IconChevron } from './FinaIcons';
import { VerTodos, recortar } from './VerTodos';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';

// Tus medios de pago, en Perfil: una fila cerrada que se abre para unir dos
// medios que en realidad son el mismo ("MP" y "Mercado Pago"). Antes vivía en
// Gastos, debajo de la torta del dinero disponible (DEBT GA2): Gastos se quedó
// con el número y esto, que se usa poco, pasó acá. Elegir un medio al cargar un
// gasto o un ingreso sigue igual, en sus formularios.

const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };

export function MediosDePago() {
  const { estado } = useAlmacen();
  const medios = estado.mediosPago;
  const [abierto, setAbierto] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [uniendo, setUniendo] = useState<string | null>(null);
  const [hacia, setHacia] = useState('');

  if (medios.length === 0) return null;

  function cerrarUnion() {
    setUniendo(null);
    setHacia('');
  }

  return (
    <section className="flex flex-col">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => { setAbierto((v) => !v); cerrarUnion(); }}
        className="v2-focus w-full flex items-center gap-3 text-left min-h-[52px] py-3 border-b rounded-none"
        style={{ borderColor: COLORS.line }}
      >
        <span className="flex-1 text-[15px] font-medium" style={{ color: COLORS.ink }}>Tus medios de pago</span>
        <span className="text-[14px] tabular-nums" style={{ color: COLORS.inkSoft }}>{medios.length}</span>
        <span style={{ color: COLORS.inkFaint }} aria-hidden>
          <IconChevron size={16} style={{ transform: abierto ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 120ms' }} />
        </span>
      </button>

      {abierto && (
        <div className="flex flex-col pt-1">
          <ul className="flex flex-col">
            {recortar(medios, verTodos).map((m) => {
              const otros = medios.filter((x) => x.nombre !== m.nombre);
              const uniendoEste = uniendo === m.nombre;
              return (
                <li key={m.id} className="py-2.5 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 truncate text-[15px]" style={{ color: COLORS.ink }}>{m.nombre}</span>
                    {otros.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={uniendoEste}
                        onClick={() => { setUniendo(uniendoEste ? null : m.nombre); setHacia(''); }}
                        className="v2-focus min-h-[44px] px-3 rounded-full text-[14px] font-semibold shrink-0"
                        style={{ color: COLORS.brand, border: `1.5px solid ${COLORS.brandSoft}` }}
                      >
                        Unir con otro
                      </button>
                    )}
                  </div>
                  {uniendoEste && (
                    <div className="flex flex-col gap-2.5" role="group" aria-label={`Unir ${m.nombre} con otro medio`}>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`unir-${m.id}`} className="text-[14px] font-bold" style={{ color: COLORS.inkSoft }}>
                          Unir "{m.nombre}" con
                        </label>
                        <div className="relative">
                          <select
                            id={`unir-${m.id}`}
                            value={hacia}
                            onChange={(e) => setHacia(e.target.value)}
                            className="v2-focus w-full appearance-none rounded-xl pl-3.5 pr-10 min-h-[48px] text-[15px]"
                            style={{ ...INPUT_STYLE, color: hacia ? COLORS.ink : COLORS.inkFaint }}
                          >
                            <option value="" style={{ color: COLORS.ink }}>Elegí el medio que queda</option>
                            {otros.map((x) => <option key={x.id} value={x.nombre} style={{ color: COLORS.ink }}>{x.nombre}</option>)}
                          </select>
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} aria-hidden>
                            <IconChevron size={16} style={{ transform: 'rotate(90deg)' }} />
                          </span>
                        </div>
                      </div>
                      {hacia && (
                        <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
                          "{m.nombre}" desaparece y sus gastos, ingresos y saldo pasan a "{hacia}". No se puede deshacer.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cerrarUnion}
                          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold"
                          style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!hacia}
                          onClick={() => { acciones.unirMedios(m.nombre, hacia); cerrarUnion(); }}
                          className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold v2-disabled"
                          style={{ background: COLORS.ink, color: COLORS.paper }}
                        >
                          Unir
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <VerTodos total={medios.length} abierta={verTodos} onToggle={() => setVerTodos((v) => !v)} />
        </div>
      )}
    </section>
  );
}

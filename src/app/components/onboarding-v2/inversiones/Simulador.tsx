import { useMemo, useState } from 'react';
import { nombreProducto, proveedoresDe, type ProductoId } from '../../../lib/inversiones/catalogo';
import { fmtPesos, pct, rangoPct } from '../../../lib/inversiones/formato';
import { fechaCorta } from '../../../lib/inversiones/mercadoTipos';
import { evaluar, inflacionDeReferencia, type Evaluacion } from '../../../lib/inversiones/motor';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { ArmarGrupoBtn, COLORS, EstadoConfianza, FONTS, fmtMoney, fmtMontoCompacto, formatThousands, OpcionesGrid, parseMoneyInput, Rango, TituloSeccion } from '../shared';
import { Parrafo } from './Hoja';

// Simulador con plata ficticia, pensado para bajar el miedo de quien nunca
// invirtió: "probalo antes de comprometerte". Usa las tasas de HOY del mercado
// (no números escritos a mano) y muestra el resultado como rango, en plata de
// hoy: una tasa nominal alta con una inflación más alta es una pérdida, y en
// pesos eso no se ve si no se traduce.

const SIMULABLES: ProductoId[] = ['cuenta_remunerada', 'fci', 'plazo_fijo', 'plazo_fijo_uva', 'letra', 'dolar', 'cedear'];

function GraficoSimulacion({
  aportado, lo, hi, meses,
}: { aportado: number[]; lo: number[]; hi: number[]; meses: number }) {
  const w = 320, h = 190;
  const padL = 46, padR = 14, padT = 12, padB = 26;
  const techo = Math.max(...hi, ...aportado, 1);
  const paso = Math.pow(10, Math.floor(Math.log10(techo))) / 2;
  const max = Math.ceil(techo / paso) * paso;
  const x = (i: number, n: number) => padL + (n > 1 ? (i / (n - 1)) * (w - padL - padR) : (w - padL - padR) / 2);
  const y = (v: number) => h - padB - (v / max) * (h - padT - padB);
  const linea = (arr: number[]) => arr.map((v, i) => `${x(i, arr.length)},${y(v)}`).join(' ');
  const guias = [0, 0.5, 1].map((f) => f * max);
  const marcasX = [0, Math.floor(meses / 2), meses - 1];
  const ultimo = aportado.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 190 }} role="img"
      aria-label={`Simulación a ${meses} meses: pondrías ${fmtMoney(aportado[ultimo] ?? 0)} y podrías tener entre ${fmtMoney(lo[ultimo] ?? 0)} y ${fmtMoney(hi[ultimo] ?? 0)}.`}>
      {guias.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke={COLORS.line} strokeWidth="1" />
          <text x={padL - 7} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill={COLORS.inkFaint} fontFamily={FONTS.mono}>{fmtMontoCompacto(v)}</text>
        </g>
      ))}
      {marcasX.map((m) => (
        <text key={m} x={x(m, meses)} y={h - 9} textAnchor="middle" fontSize="9.5" fill={COLORS.inkFaint} fontFamily={FONTS.mono}>{m === 0 ? 'hoy' : `${m + 1}m`}</text>
      ))}
      <polygon
        points={`${hi.map((v, i) => `${x(i, hi.length)},${y(v)}`).join(' ')} ${[...lo].reverse().map((v, i) => `${x(lo.length - 1 - i, lo.length)},${y(v)}`).join(' ')}`}
        fill={COLORS.brand}
        opacity="0.14"
      />
      <polyline points={linea(aportado)} fill="none" stroke={COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={linea(hi)} fill="none" stroke={COLORS.brand} strokeWidth="1.5" strokeDasharray="2 3" strokeLinecap="round" />
      <polyline points={linea(lo)} fill="none" stroke={COLORS.brand} strokeWidth="1.5" strokeDasharray="2 3" strokeLinecap="round" />
      <circle cx={x(ultimo, aportado.length)} cy={y(aportado[ultimo])} r="4" fill={COLORS.ink} stroke={COLORS.surface} strokeWidth="2" />
    </svg>
  );
}

export function Simulador() {
  const { estado } = useMercado();
  const [producto, setProducto] = useState<ProductoId>('cuenta_remunerada');
  const [monto, setMonto] = useState('10.000');
  const [meses, setMeses] = useState(12);
  const montoNum = parseMoneyInput(monto);

  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const infl = useMemo(() => (mercado ? inflacionDeReferencia(mercado) : null), [mercado]);

  // La mejor opción vigente de este producto: la que hoy más rinde después de la inflación.
  const mejor: Evaluacion | null = useMemo(() => {
    if (!mercado || !infl) return null;
    const evals = proveedoresDe(producto)
      .map((p) => evaluar(producto, p.id, mercado, infl))
      .filter((e): e is Evaluacion => e !== null && e.vigente && e.veredicto !== 'sin-dato');
    return evals.sort((a, b) => (b.real?.max ?? -1) - (a.real?.max ?? -1))[0] ?? null;
  }, [mercado, infl, producto]);

  const proyeccion = useMemo(() => {
    if (!mejor?.tem || !infl || montoNum <= 0) return null;
    const { min, max } = mejor.tem;
    const aportado: number[] = [], lo: number[] = [], hi: number[] = [];
    let acAp = 0, acLo = 0, acHi = 0;
    for (let i = 0; i < meses; i++) {
      acAp += montoNum;
      acLo = (acLo + montoNum) * (1 + min);
      acHi = (acHi + montoNum) * (1 + max);
      aportado.push(acAp); lo.push(acLo); hi.push(acHi);
    }
    // Plata de hoy: cada cuota se descuenta por los meses que pasaron desde que entró.
    const f = Math.pow(1 + infl.mensual, meses);
    let aportadoReal = 0;
    for (let i = 1; i <= meses; i++) aportadoReal += montoNum / Math.pow(1 + infl.mensual, i);
    return {
      aportado, lo, hi,
      loFinal: lo[meses - 1], hiFinal: hi[meses - 1],
      loReal: lo[meses - 1] / f, hiReal: hi[meses - 1] / f, aportadoReal,
    };
  }, [mejor, infl, montoNum, meses]);

  const sinRendimiento = mejor && !mejor.tem;

  return (
    <div className="flex flex-col gap-5">
      <TituloSeccion>Probá antes de invertir plata real</TituloSeccion>
      <Parrafo>Elegí qué querés probar y un monto imaginario. No mueve plata: usa las tasas de hoy para mostrarte cómo funciona cada opción.</Parrafo>

      <div className="flex flex-col gap-2.5">
        <TituloSeccion>¿En qué?</TituloSeccion>
        <OpcionesGrid opciones={SIMULABLES.map((id) => ({ id, label: nombreProducto(id) }))} valor={producto} onElegir={setProducto} />
      </div>

      {estado.tipo === 'cargando' && <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Trayendo las tasas de hoy…</p>}
      {estado.tipo === 'error' && <Parrafo>No pudimos traer las tasas de hoy, así que no podemos simular con números reales. Probá de nuevo en un rato.</Parrafo>}
      {mercado && !infl && <Parrafo>No tenemos un dato de inflación al día, así que no podemos mostrarte el resultado en plata de hoy.</Parrafo>}
      {mercado && infl && !mejor && <Parrafo>De esta opción no tenemos un dato de hoy, así que no la simulamos con números inventados.</Parrafo>}

      {mejor && (
        <>
          {sinRendimiento ? (
            <div className="flex flex-col gap-2">
              <Parrafo suave={false}>{mejor.detalle}</Parrafo>
              {mejor.notas.map((n) => <Parrafo key={n}>{n}</Parrafo>)}
              <Parrafo>No se simula porque no hay un rendimiento que se pueda prometer: cualquier número sería inventado.</Parrafo>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                <TituloSeccion>¿Cuánto por mes?</TituloSeccion>
                <div className="relative">
                  <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
                  <input
                    aria-label="Cuánto pondrías por mes"
                    className="v2-focus w-full rounded-2xl pl-8 pr-4 py-3 text-[18px] font-mono tabular-nums outline-none"
                    style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    placeholder="Cuánto pondrías por mes"
                    inputMode="decimal"
                    value={monto}
                    onChange={(e) => setMonto(formatThousands(e.target.value))}
                  />
                </div>
                <div className="flex gap-2">
                  {[6, 12, 24].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMeses(m)}
                      aria-pressed={meses === m}
                      className="v2-focus flex-1 min-h-[44px] rounded-2xl text-[15px] font-bold transition-all duration-100 active:scale-[0.97]"
                      style={meses === m
                        ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                        : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    >
                      {m} meses
                    </button>
                  ))}
                </div>
              </div>

              {proyeccion && infl && mejor.tna && (
                <>
                  <GraficoSimulacion aportado={proyeccion.aportado} lo={proyeccion.lo} hi={proyeccion.hi} meses={meses} />
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 h-[2px] rounded-full shrink-0" style={{ background: COLORS.ink }} />
                    <span className="flex-1 text-[15px]" style={{ color: COLORS.inkSoft }}>Lo que pondrías</span>
                    <span className="font-mono tabular-nums font-semibold text-[15px]" style={{ color: COLORS.ink }}>{fmtPesos(proyeccion.aportado[meses - 1])}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>A los {meses} meses podrías tener</p>
                    <Rango min={proyeccion.loFinal} max={proyeccion.hiFinal} />
                    <EstadoConfianza estado="estimado" />
                  </div>

                  <div
                    className="flex flex-col gap-1.5 pt-1 pl-3.5 border-l-2"
                    style={{ borderColor: proyeccion.loReal > proyeccion.aportadoReal ? COLORS.lima : COLORS.star }}
                  >
                    <p className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>En plata de hoy</p>
                    <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
                      Con una inflación de {pct(infl.mensual * 100, 1)} por mes ({pct(infl.anual * 100, 0)} al año), eso compraría como entre{' '}
                      <span className="font-mono tabular-nums font-bold" style={{ color: COLORS.ink }}>{fmtPesos(proyeccion.loReal)}</span> y{' '}
                      <span className="font-mono tabular-nums font-bold" style={{ color: COLORS.ink }}>{fmtPesos(proyeccion.hiReal)}</span> de hoy, contra{' '}
                      <span className="font-mono tabular-nums">{fmtPesos(proyeccion.aportadoReal)}</span> que habrías puesto medido igual.{' '}
                      {proyeccion.loReal > proyeccion.aportadoReal
                        ? 'En todo el rango le ganás a la inflación.'
                        : proyeccion.hiReal < proyeccion.aportadoReal
                          ? 'Con las tasas de hoy no le ganás a la inflación: la seguís de cerca pero comprás un poco menos.'
                          : 'Queda a la par: según cómo se muevan las tasas, apenas por encima o apenas por debajo.'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <TituloSeccion>Cómo se hizo esta cuenta</TituloSeccion>
                    <Parrafo>{mejor.detalle}</Parrafo>
                    <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
                      Usamos una tasa anual entre <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{rangoPct(mejor.tna.min, mejor.tna.max, 1).replace('entre ', '')}</span>:
                      la banda del gráfico va de una punta a la otra, porque ninguna tasa es fija.
                    </p>
                    <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
                      Fuente: {mejor.fuente}{mejor.fecha ? `, dato al ${fechaCorta(mejor.fecha)}` : ''}. Las tasas cambian: esto se actualiza solo.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <p className="text-[14px] leading-snug" style={{ color: COLORS.inkFaint }}>
        Es una simulación con las tasas de hoy: no es una promesa de rendimiento y no mueve plata real.
      </p>
      <ArmarGrupoBtn />
    </div>
  );
}

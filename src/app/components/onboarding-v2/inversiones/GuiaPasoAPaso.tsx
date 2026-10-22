import { useEffect, useMemo, useState } from 'react';
import { leerPlan, guardarPlan } from '../../../api/v2/planes';
import { PROVEEDORES, type ProductoId, type ProveedorId } from '../../../lib/inversiones/catalogo';
import { saveFeedback } from '../../../lib/feedback';
import { fmtPesos, nombrePropio, pct } from '../../../lib/inversiones/formato';
import { armarGuia } from '../../../lib/inversiones/guias';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { bancosOrdenados, type Evaluacion } from '../../../lib/inversiones/motor';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import type { Valores } from '../../../lib/inversiones/registro';
import { BotonFantasma, CheckIcon, COLORS, Cta, EstadoConfianza, formatThousands, parseMoneyInput, formatMontoInicial, TituloSeccion } from '../shared';
import { Hoja, Parrafo } from './Hoja';

// El paso a paso. La idea: que la persona llegue a hacer algo que, sola, no
// habría podido. Cada paso dice qué hacer, cómo se ve en la pantalla, qué
// cambia con eso y cómo saber que salió bien. El avance se guarda: si lo deja a
// la mitad y vuelve, sigue donde estaba.
export function GuiaPasoAPaso({
  producto, proveedor, mercado, evaluacion, sugerencia, onRegistrar, onCerrar,
}: {
  producto: ProductoId;
  proveedor: ProveedorId;
  mercado: Mercado;
  evaluacion: Evaluacion | null;
  sugerencia: SugerenciaMonto;
  onRegistrar: (previos: Partial<Valores>) => void;
  onCerrar: () => void;
}) {
  const prov = PROVEEDORES[proveedor];
  const bancos = useMemo(() => bancosOrdenados(mercado).slice(0, 12), [mercado]);
  const [montoTxt, setMontoTxt] = useState(sugerencia.primero ? formatMontoInicial(sugerencia.primero) : '');
  const [banco, setBanco] = useState<string | null>(null);
  const [hechos, setHechos] = useState<number[]>([]);
  const [empezo, setEmpezo] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [sinEncontrar, setSinEncontrar] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [avisado, setAvisado] = useState<string[]>([]);

  const monto = parseMoneyInput(montoTxt) || null;

  // Retoma donde había quedado.
  useEffect(() => {
    let vivo = true;
    leerPlan(producto, proveedor).then((plan) => {
      if (!vivo) return;
      if (plan) {
        setHechos(plan.hechos);
        if (plan.monto) setMontoTxt(formatMontoInicial(plan.monto));
        setEmpezo(plan.hechos.length > 0 || plan.monto !== null);
      }
      setCargado(true);
    });
    return () => { vivo = false; };
  }, [producto, proveedor]);

  const guia = useMemo(
    () => armarGuia(proveedor, producto, { monto, mercado, evaluacion, banco }),
    [proveedor, producto, monto, mercado, evaluacion, banco],
  );
  if (!guia) return null;

  const total = guia.pasos.length;
  const actual = guia.pasos.findIndex((_, i) => !hechos.includes(i));

  function guardar(nuevos: number[], m: number | null = monto) {
    setHechos(nuevos);
    void guardarPlan({ producto, proveedor, monto: m, hechos: nuevos });
  }

  async function avisarQueNoLoEncuentra(idPaso: string) {
    await saveFeedback(`guia:${proveedor}:${producto}:${idPaso}`, 1, comentario.trim() || 'No lo encontré');
    setAvisado((a) => [...a, idPaso]);
    setSinEncontrar(null);
    setComentario('');
  }

  const previosRegistro = (): Partial<Valores> => ({
    proveedor: producto === 'plazo_fijo' || producto === 'plazo_fijo_uva' ? (banco ? nombrePropio(banco) : '') : prov.nombre,
    ...(monto ? { monto: formatMontoInicial(monto) } : {}),
    ...(producto === 'plazo_fijo_uva' ? { plazo: '90' } : {}),
  });

  // ── Antes de empezar ──
  if (!empezo) {
    const esPlazo = producto === 'plazo_fijo' || producto === 'plazo_fijo_uva';
    return (
      <Hoja titulo={guia.titulo} onCerrar={onCerrar}>
        {!cargado ? (
          <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Un segundo…</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <TituloSeccion>Qué vas a lograr</TituloSeccion>
              <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{guia.alTerminar}</p>
              <Parrafo>{guia.tiempo}</Parrafo>
            </div>

            <div className="flex flex-col gap-1.5">
              <TituloSeccion>Qué necesitás</TituloSeccion>
              <Parrafo>{prov.paraEmpezar}</Parrafo>
            </div>

            {esPlazo && bancos.length > 0 && (
              <div className="flex flex-col gap-2">
                <TituloSeccion>¿En qué banco?</TituloSeccion>
                <select
                  aria-label="Banco"
                  className="v2-focus w-full rounded-2xl px-4 py-3 text-[16px] outline-none"
                  style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  value={banco ?? ''}
                  onChange={(e) => setBanco(e.target.value || null)}
                >
                  <option value="">Mi banco (no está en la lista)</option>
                  {bancos.map((b) => (
                    <option key={b.entidad} value={b.entidad}>{nombrePropio(b.entidad)} — {pct(b.tna * 100, 1)} anual a 30 días</option>
                  ))}
                </select>
                <Parrafo>Las tasas son para clientes del banco. Si ya tenés cuenta en alguno, empezá por ese.</Parrafo>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <TituloSeccion>¿Con cuánto querés empezar?</TituloSeccion>
              <div className="relative">
                <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
                <input
                  aria-label="Monto con el que empezar"
                  className="v2-focus w-full rounded-2xl pl-8 pr-4 py-3 text-[18px] font-mono tabular-nums outline-none"
                  style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  inputMode="decimal"
                  placeholder="Monto"
                  value={montoTxt}
                  onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
                />
              </div>
              {sugerencia.primero ? (
                <>
                  <Parrafo>Te sugerimos {fmtPesos(sugerencia.primero)} para la primera vez, según lo que te queda cada mes.</Parrafo>
                  <EstadoConfianza estado="estimado" />
                </>
              ) : (
                <Parrafo>{sugerencia.mensajes[0]} Elegí un monto chico que no necesites: la primera vez es para ver cómo funciona.</Parrafo>
              )}
            </div>

            <Cta
              label="Empezar"
              disabled={!monto}
              onClick={() => { setEmpezo(true); void guardarPlan({ producto, proveedor, monto, hechos }); }}
            />
          </>
        )}
      </Hoja>
    );
  }

  // ── Los pasos ──
  const terminada = actual === -1;
  return (
    <Hoja titulo={guia.titulo} onCerrar={onCerrar} ancho={460}>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>
          {terminada ? `Hiciste los ${total} pasos` : `Paso ${actual + 1} de ${total}`}
          {monto ? ` · con ${fmtPesos(monto)}` : ''}
        </p>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }} aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${(hechos.length / total) * 100}%`, background: COLORS.lima }} />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {guia.pasos.map((p, i) => {
          const hecho = hechos.includes(i);
          const esActual = i === actual;
          if (hecho) {
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 min-h-[44px]">
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0" style={{ color: COLORS.limaText }}><CheckIcon /></span>
                  <span className="text-[15px] truncate" style={{ color: COLORS.inkSoft }}>{p.titulo}</span>
                </span>
                <button
                  type="button"
                  onClick={() => guardar(hechos.filter((h) => h !== i))}
                  className="v2-focus min-h-[44px] px-2 text-[13px] font-semibold shrink-0"
                  style={{ color: COLORS.inkFaint }}
                >
                  Deshacer
                </button>
              </li>
            );
          }
          if (!esActual) {
            return (
              <li key={p.id} className="flex items-center gap-2.5 min-h-[40px]">
                <span className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold" style={{ border: `1.5px solid ${COLORS.lineStrong}`, color: COLORS.inkFaint }}>{i + 1}</span>
                <span className="text-[15px]" style={{ color: COLORS.inkFaint }}>{p.titulo}</span>
              </li>
            );
          }
          return (
            <li key={p.id} className="flex flex-col gap-3.5 rounded-2xl p-4" style={{ border: `1.5px solid ${COLORS.brand}`, background: COLORS.surface }}>
              <h3 className="text-[19px] font-bold leading-snug" style={{ color: COLORS.ink }}>{p.titulo}</h3>
              <Bloque t="Qué hacés" x={p.haces} fuerte />
              <Bloque t="Cómo se ve" x={p.loVes} />
              <Bloque t="Qué lográs con esto" x={p.lograras} />
              {p.datos && p.datos.length > 0 && (
                <div className="flex flex-col pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
                  {p.datos.map((d) => (
                    <p key={`${d.etiqueta}-${d.valor}`} className="text-[14px] leading-snug py-0.5" style={{ color: COLORS.inkSoft }}>
                      {d.etiqueta}: <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{d.valor}</span>
                    </p>
                  ))}
                </div>
              )}
              <Bloque t="Sabés que salió bien cuando" x={p.chequeo} />

              {p.registra ? (
                <Cta label="Anotarla en FINA" onClick={() => { guardar([...hechos, i]); onRegistrar(previosRegistro()); }} />
              ) : (
                <Cta label="Ya lo hice" onClick={() => guardar([...hechos, i])} />
              )}

              {avisado.includes(p.id) ? (
                <p className="text-[14px] text-center" style={{ color: COLORS.inkSoft }}>Gracias, lo vamos a revisar.</p>
              ) : sinEncontrar === p.id ? (
                <div className="flex flex-col gap-2">
                  <label className="text-[14px]" style={{ color: COLORS.inkSoft }} htmlFor={`sin-${p.id}`}>¿Qué ves en su lugar? (opcional)</label>
                  <textarea
                    id={`sin-${p.id}`}
                    rows={2}
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    className="v2-focus w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
                    style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                  />
                  <Cta label="Avisarle a FINA" onClick={() => void avisarQueNoLoEncuentra(p.id)} />
                </div>
              ) : (
                <BotonFantasma label="No lo encuentro" onClick={() => setSinEncontrar(p.id)} />
              )}
            </li>
          );
        })}
      </ol>

      {terminada && (
        <div className="flex flex-col gap-2">
          <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>
            Listo: {guia.alTerminar.charAt(0).toLowerCase() + guia.alTerminar.slice(1)}
          </p>
          <Cta label="Anotarla en FINA" onClick={() => onRegistrar(previosRegistro())} />
        </div>
      )}

      {guia.porVerificar.length > 0 && (
        <details>
          <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[13px]" style={{ color: COLORS.inkFaint }}>
            Pasos armados con información pública: si algo se ve distinto en tu app, avisanos
          </summary>
          <ul className="list-disc pl-5 text-[13px] leading-snug flex flex-col gap-1" style={{ color: COLORS.inkFaint }}>
            {guia.porVerificar.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </details>
      )}
    </Hoja>
  );
}

function Bloque({ t, x, fuerte = false }: { t: string; x: string; fuerte?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[13px] font-bold" style={{ color: COLORS.inkFaint }}>{t}</p>
      <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: fuerte ? COLORS.ink : COLORS.inkSoft, fontWeight: fuerte ? 600 : 400 }}>{x}</p>
    </div>
  );
}

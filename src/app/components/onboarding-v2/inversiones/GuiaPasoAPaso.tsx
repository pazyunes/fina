import { useEffect, useMemo, useState } from 'react';
import { leerPlan, guardarPlan } from '../../../api/v2/planes';
import { PRODUCTOS, PROVEEDORES, type ProductoId, type ProveedorId } from '../../../lib/inversiones/catalogo';
import { saveFeedback } from '../../../lib/feedback';
import { fmtPesos, nombrePropio, pct } from '../../../lib/inversiones/formato';
import { armarGuia, type PasoGuia } from '../../../lib/inversiones/guias';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { bancosOrdenados, type Evaluacion } from '../../../lib/inversiones/motor';
import { describirRinde } from '../../../lib/inversiones/rinde';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import type { Valores } from '../../../lib/inversiones/registro';
import { BotonFantasma, COLORS, Cta, formatMontoInicial, formatThousands, parseMoneyInput, TituloSeccion } from '../shared';
import { GlobitoCuando, GlobitoDonde, GlobitoGarantia, GlobitoGlosario, GlobitoQueEs, GlobitoRiesgo, GlobitoRinde } from './Ficha';
import { Hoja, Parrafo } from './Hoja';

type Fase = 'aprende' | 'monto' | 'pasos';

// El paso a paso. La idea: que la persona llegue a hacer algo que, sola, no
// habría podido. Tiene tres momentos:
//   1. "Aprendé en 2 minutos": tres pantallas cortas con lo esencial.
//   2. Con cuánto empezar (y en qué banco, si es un plazo fijo).
//   3. Los pasos, numerados, que se pueden recorrer para adelante y para atrás.
// El avance se guarda: si lo deja a la mitad y vuelve, sigue donde estaba.
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
  const p = PRODUCTOS[producto];
  const bancos = useMemo(() => bancosOrdenados(mercado).slice(0, 12), [mercado]);
  const [fase, setFase] = useState<Fase | null>(null);
  const [pantalla, setPantalla] = useState(0);
  const [montoTxt, setMontoTxt] = useState(sugerencia.primero ? formatMontoInicial(sugerencia.primero) : '');
  const [banco, setBanco] = useState<string | null>(null);
  const [hechos, setHechos] = useState<number[]>([]);
  const [abierto, setAbierto] = useState(0);
  const [sinEncontrar, setSinEncontrar] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [avisado, setAvisado] = useState<string[]>([]);

  const monto = parseMoneyInput(montoTxt) || null;

  // Retoma donde había quedado; si es la primera vez, arranca por lo que hay que saber.
  useEffect(() => {
    let vivo = true;
    leerPlan(producto, proveedor).then((plan) => {
      if (!vivo) return;
      if (plan && (plan.hechos.length > 0 || plan.monto !== null)) {
        setHechos(plan.hechos);
        if (plan.monto) setMontoTxt(formatMontoInicial(plan.monto));
        setFase('pasos');
      } else {
        setFase('aprende');
      }
    });
    return () => { vivo = false; };
  }, [producto, proveedor]);

  const guia = useMemo(
    () => armarGuia(proveedor, producto, { monto, mercado, evaluacion, banco }),
    [proveedor, producto, monto, mercado, evaluacion, banco],
  );
  const total = guia?.pasos.length ?? 0;

  // Al entrar a los pasos se abre el primero que falta.
  useEffect(() => {
    if (fase === 'pasos' && total > 0) {
      const primero = Array.from({ length: total }, (_, i) => i).find((i) => !hechos.includes(i));
      setAbierto(primero ?? total - 1);
    }
    // Sólo al cambiar de fase: después manda la persona.
  }, [fase, total]);

  if (!guia) return null;

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

  if (fase === null) {
    return <Hoja titulo={guia.titulo} onCerrar={onCerrar}><p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Un segundo…</p></Hoja>;
  }

  // ── 1. Aprendé en 2 minutos ──
  if (fase === 'aprende') {
    const ficha = describirRinde(producto, evaluacion, mercado);
    const ultima = pantalla === 2;
    return (
      <Hoja titulo="Aprendé en 2 minutos" onCerrar={onCerrar}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2" role="img" aria-label={`Pantalla ${pantalla + 1} de 3`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= pantalla ? COLORS.brand : COLORS.lineStrong }} />
            ))}
          </div>
          <button type="button" onClick={() => setFase('monto')} className="v2-focus min-h-[44px] px-2 text-[14px] font-semibold" style={{ color: COLORS.inkFaint }}>
            Saltear
          </button>
        </div>
        <p className="text-[15px] -mt-2" style={{ color: COLORS.inkSoft }}>Lo esencial de {p.nombre.toLowerCase()} antes de hacerlo.</p>

        <div className="flex flex-col gap-3.5">
          {pantalla === 0 && (<><GlobitoQueEs p={p} /><GlobitoDonde p={p} /></>)}
          {pantalla === 1 && (<><GlobitoRinde ficha={ficha} confianza={evaluacion?.confianza ?? 'por-descubrir'} /><GlobitoRiesgo p={p} /></>)}
          {pantalla === 2 && (<><GlobitoCuando p={p} /><GlobitoGarantia p={p} /><GlobitoGlosario p={p} /></>)}
        </div>

        <div className="flex flex-col gap-2">
          <Cta label={ultima ? '¡Empecemos!' : 'Siguiente'} onClick={() => (ultima ? setFase('monto') : setPantalla(pantalla + 1))} />
          {pantalla > 0 && <BotonFantasma label="Atrás" onClick={() => setPantalla(pantalla - 1)} />}
        </div>
      </Hoja>
    );
  }

  // ── 2. Con cuánto ──
  if (fase === 'monto') {
    const esPlazo = producto === 'plazo_fijo' || producto === 'plazo_fijo_uva';
    return (
      <Hoja titulo={guia.titulo} onCerrar={onCerrar}>
        <div className="flex flex-col gap-1.5">
          <TituloSeccion>Qué vas a lograr</TituloSeccion>
          <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{guia.alTerminar}</p>
          <Parrafo>{guia.tiempo} Vas a necesitar: {prov.paraEmpezar.charAt(0).toLowerCase() + prov.paraEmpezar.slice(1)}</Parrafo>
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
          <Parrafo>
            {sugerencia.primero
              ? `Te conviene empezar con ${fmtPesos(sugerencia.primero)}: es lo que te suele sobrar.`
              : 'Empezá con un monto chico que no necesites este mes: la primera vez es para ver cómo funciona.'}
          </Parrafo>
        </div>

        <div className="flex flex-col gap-2">
          <Cta
            label="Continuar"
            disabled={!monto}
            onClick={() => { void guardarPlan({ producto, proveedor, monto, hechos }); setFase('pasos'); }}
          />
          <BotonFantasma label="Ver de nuevo lo básico" onClick={() => { setPantalla(0); setFase('aprende'); }} />
        </div>
      </Hoja>
    );
  }

  // ── 3. Los pasos ──
  const terminada = hechos.length === total;
  const hacer = (i: number, paso: PasoGuia) => {
    const nuevos = hechos.includes(i) ? hechos : [...hechos, i];
    guardar(nuevos);
    if (paso.registra) { onRegistrar(previosRegistro()); return; }
    if (i < total - 1) setAbierto(i + 1);
  };

  return (
    <Hoja titulo={guia.titulo} onCerrar={onCerrar} ancho={460}>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>
          {terminada ? `Hiciste los ${total} pasos` : `${hechos.length} de ${total} pasos hechos`}
          {monto ? ` · con ${fmtPesos(monto)}` : ''}
        </p>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }} aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${(hechos.length / total) * 100}%`, background: COLORS.lima }} />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {guia.pasos.map((paso, i) => {
          const hecho = hechos.includes(i);
          const expandido = abierto === i;
          return (
            <li key={paso.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => setAbierto(expandido ? -1 : i)}
                aria-expanded={expandido}
                className="v2-focus flex items-center gap-3 min-h-[52px] text-left"
              >
                <NumeroPaso n={i + 1} hecho={hecho} actual={expandido} />
                <span className="flex-1 min-w-0 text-[16px] leading-snug" style={{ color: expandido ? COLORS.ink : hecho ? COLORS.inkSoft : COLORS.inkFaint, fontWeight: expandido ? 700 : 500 }}>
                  {paso.titulo}
                </span>
                {hecho && <span className="text-[13px] font-semibold shrink-0" style={{ color: COLORS.limaText }}>Hecho</span>}
              </button>

              {expandido && (
                <div className="flex flex-col gap-3.5 rounded-2xl p-4 mt-1 mb-2" style={{ border: `1.5px solid ${COLORS.brand}`, background: COLORS.surface }}>
                  <Bloque t="Qué hacés" x={paso.haces} fuerte />
                  <Bloque t="Cómo se ve" x={paso.loVes} />
                  <Bloque t="Qué lográs con esto" x={paso.lograras} />
                  {paso.datos && paso.datos.length > 0 && (
                    <div className="flex flex-col pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
                      {paso.datos.map((d) => (
                        <p key={`${d.etiqueta}-${d.valor}`} className="text-[14px] leading-snug py-0.5" style={{ color: COLORS.inkSoft }}>
                          {d.etiqueta}: <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{d.valor}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <Bloque t="Sabés que salió bien cuando" x={paso.chequeo} />

                  {hecho && !paso.registra ? (
                    <>
                      {i < total - 1 && <Cta label="Ir al paso siguiente" onClick={() => setAbierto(i + 1)} />}
                      <BotonFantasma label="Marcar como pendiente" onClick={() => guardar(hechos.filter((h) => h !== i))} />
                    </>
                  ) : (
                    <Cta label={paso.registra ? 'Anotarla en FINA' : 'Ya lo hice'} onClick={() => hacer(i, paso)} />
                  )}
                  {i > 0 && <BotonFantasma label="← Volver al paso anterior" onClick={() => setAbierto(i - 1)} />}

                  {avisado.includes(paso.id) ? (
                    <p className="text-[14px] text-center" style={{ color: COLORS.inkSoft }}>Gracias, lo vamos a revisar.</p>
                  ) : sinEncontrar === paso.id ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-[14px]" style={{ color: COLORS.inkSoft }} htmlFor={`sin-${paso.id}`}>¿Qué ves en su lugar? (opcional)</label>
                      <textarea
                        id={`sin-${paso.id}`}
                        rows={2}
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        className="v2-focus w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
                        style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                      />
                      <Cta label="Avisarle a FINA" onClick={() => void avisarQueNoLoEncuentra(paso.id)} />
                    </div>
                  ) : (
                    <BotonFantasma label="No lo encuentro" onClick={() => setSinEncontrar(paso.id)} />
                  )}
                </div>
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

      <BotonFantasma label="Ver de nuevo lo básico" onClick={() => { setPantalla(0); setFase('aprende'); }} />

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

/** El número del paso, siempre visible: lleno de lima si ya está hecho, violeta si es el que estás mirando. */
function NumeroPaso({ n, hecho, actual }: { n: number; hecho: boolean; actual: boolean }) {
  const estilo = actual
    ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
    : hecho
      ? { background: COLORS.lima, color: COLORS.ink, border: `1.5px solid ${COLORS.lima}` }
      : { background: COLORS.surface, color: COLORS.inkFaint, border: `1.5px solid ${COLORS.lineStrong}` };
  return (
    <span
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[15px] font-bold font-mono tabular-nums"
      style={estilo}
      aria-label={`Paso ${n}${hecho ? ', hecho' : ''}`}
    >
      {n}
    </span>
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

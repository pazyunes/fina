import { useEffect, useMemo, useState } from 'react';
import type { PosicionInversion } from '../../../api/v2/tipos';
import type { PerfilRiesgo, ProductoId, ProveedorId } from '../../../lib/inversiones/catalogo';
import { TRAMOS } from '../../../lib/inversiones/cartera';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import type { InflacionPersonal } from '../../../lib/inversiones/inflacionPersonal';
import { RUBROS } from '../../../lib/inversiones/ipc';
import { pct } from '../../../lib/inversiones/formato';
import { hayFallaEsencial, MENSAJE_DE_ERROR } from '../../../lib/inversiones/estadoDatos';
import { planDeObjetivo, type ObjetivoParaInvertir } from '../../../lib/inversiones/objetivos';
import { fmtPesos } from '../../../lib/inversiones/formato';
import { recomendar, type ItemProducto, type Recomendacion } from '../../../lib/inversiones/motor';
import type { Valores } from '../../../lib/inversiones/registro';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { IconChevron } from '../FinaIcons';
import { COLORS, EstadoConfianza, formatThousands, parseMoneyInput, TituloSeccion } from '../shared';
import { CuantoPoner } from './CuantoPoner';
import { FlujoInversion } from './FlujoInversion';
import { Parrafo } from './Hoja';
import { MercadoHoy } from './MercadoHoy';
import { AprendeCards } from './AprendeCards';

// Cuánto tiempo puede dejar la plata quieta, en meses (para recomendar).
const TIEMPOS: { id: string; label: string; meses: number }[] = [
  { id: 'corto', label: 'Menos de 3 meses', meses: 2 },
  { id: 'medio', label: '3 a 12 meses', meses: 6 },
  { id: 'largo', label: '1 a 3 años', meses: 24 },
  { id: 'mlargo', label: 'Más de 3 años', meses: 48 },
];

// La pestaña de alternativas. La persona puede contar cuánto quiere invertir y en cuánto
// tiempo lo quiere sacar, y las alternativas que hoy encajan con su plazo y su perfil se
// marcan con un cartelito verde y con la parte de la plata que les corresponde. O puede
// elegir directo una inversión. Todo sale de los datos de mercado de hoy: sin datos, no hay nada que sugerir.
export function RecomendacionesTab({
  perfil, horizonteMeses, usa, posiciones, productosQuiz, sugerencia, gastoCercano, objetivoEnDolares, inflacionPersonal, objetivos, reabrir, onReabierto, onRegistrar,
}: {
  perfil: PerfilRiesgo;
  horizonteMeses: number | null;
  usa: ProveedorId[];
  posiciones: PosicionInversion[];
  /** Lo que dijo en el quiz que ya hace, además de lo que tiene registrado. */
  productosQuiz: ProductoId[];
  sugerencia: SugerenciaMonto;
  /** Tiene un gasto cercano que no alcanza a cubrir con lo que ingresa: se suma un fondo de garantía. */
  gastoCercano: boolean;
  /** Tiene un objetivo en dólares: sólo así el dólar entra entre las alternativas. */
  objetivoEnDolares: boolean;
  /** Lo que subió lo que esta persona consume, si se pudo calcular. */
  inflacionPersonal: InflacionPersonal | null;
  /** Los objetivos para los que se podría invertir (en pesos, con algo por juntar). */
  objetivos: ObjetivoParaInvertir[];
  /** Si no es null: reabre el paso a paso de esa inversión (se volvió desde el registro). */
  reabrir: PosicionInversion['tipo'] | null;
  onReabierto: () => void;
  /** `desdeGuia`: se llegó desde el paso a paso, así el registro puede volver a él. */
  onRegistrar: (tipo: PosicionInversion['tipo'], previos: Partial<Valores>, desdeGuia?: boolean) => void;
}) {
  const { estado, reintentar } = useMercado();
  // Arranca con lo que sobró el mes pasado: lo sugerido es invertirlo todo.
  const [montoTxt, setMontoTxt] = useState(() => (sugerencia.primero ? formatThousands(String(sugerencia.primero)) : ''));
  const [tiempo, setTiempo] = useState<string | null>(null);
  const [objetivoId, setObjetivoId] = useState<string | null>(null);
  const objetivo = objetivos.find((o) => o.id === objetivoId) ?? null;
  const [abierta, setAbierta] = useState<Recomendacion | null>(null);

  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const monto = parseMoneyInput(montoTxt) || null;
  // Si la plata es para un objetivo con fecha, el plazo lo marca el objetivo; si no, lo que elija o lo del quiz.
  const horizonte = objetivo?.meses ?? (tiempo ? (TIEMPOS.find((t) => t.id === tiempo)?.meses ?? null) : horizonteMeses);

  const yaInvierteEn = useMemo(
    () => [...new Set([...productosQuiz, ...posiciones.filter((p) => p.estado === 'activa').map((p) => p.tipo as ProductoId)])],
    [posiciones, productosQuiz],
  );
  const resultado = useMemo(
    () => (mercado
      ? recomendar({ mercado, perfil, horizonteMeses: horizonte, monto, usa, yaInvierteEn, necesitaCaja: gastoCercano, objetivoEnDolares, inflacionPersonal: inflacionPersonal?.mensual ?? null })
      : null),
    [mercado, perfil, horizonte, monto, usa, yaInvierteEn, gastoCercano, objetivoEnDolares, inflacionPersonal],
  );

  // Al volver del registro, el paso a paso se retoma donde estaba (el avance ya está guardado).
  useEffect(() => {
    if (!reabrir || !resultado) return;
    const item = resultado.items.find((i) => i.rec.producto.id === reabrir);
    if (item) setAbierta(item.rec);
    onReabierto();
  }, [reabrir, resultado, onReabierto]);

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Trayendo los datos de hoy">
        {[0, 1, 2].map((i) => <div key={i} className="h-[72px] rounded-2xl" style={{ background: COLORS.tint }} />)}
        <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Trayendo los datos de hoy…</p>
      </div>
    );
  }
  // Cualquier problema con los datos se le muestra igual a la persona: un error corto y reintentar
  // más tarde. El detalle de qué falló le llega a quien mantiene FINA (ver estadoDatos.ts).
  if (estado.tipo === 'error' || !mercado || !resultado || resultado.sinBase || hayFallaEsencial(mercado)) {
    return (
      <div className="flex flex-col gap-3" role="alert">
        <TituloSeccion>{MENSAJE_DE_ERROR.titulo}</TituloSeccion>
        <Parrafo>{MENSAJE_DE_ERROR.texto}</Parrafo>
        <button type="button" onClick={reintentar} className="v2-focus self-start min-h-[44px] rounded-full px-5 text-[15px] font-bold" style={{ border: `1.5px solid ${COLORS.brand}`, color: COLORS.brand }}>
          Reintentar
        </button>
      </div>
    );
  }

  const fila = (it: ItemProducto) => {
    const r = it.rec;
    return (
      <button
        key={r.producto.id}
        type="button"
        onClick={() => setAbierta(r)}
        className="v2-focus relative w-full text-left flex items-center gap-3 py-4 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
        style={{ borderColor: COLORS.line }}
      >
        <span className="flex-1 min-w-0 flex flex-col gap-1 pr-24">
          <span className="font-bold text-[17px]" style={{ color: COLORS.ink }}>{r.producto.nombre}</span>
          <span className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.producto.resumen}</span>
          {it.recomendado && it.peso !== null && (
            <span className="text-[14px] font-semibold leading-snug" style={{ color: COLORS.ink }}>
              Para el <span className="font-mono tabular-nums">{Math.round(it.peso * 100)}%</span> de tu plata{it.parte ? <> · {it.parte}</> : null}
              {monto ? <> (unos <span className="font-mono tabular-nums">{fmtPesos(monto * it.peso)}</span>)</> : null}
            </span>
          )}
          {it.recomendado && it.peso === null && it.parte && (
            <span className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>Reserva opcional, sin porcentaje · {it.parte}</span>
          )}
          {it.motivo && <span className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>{it.motivo}</span>}
        </span>
        {it.recomendado && (
          <span
            className="absolute top-3 right-0 text-[12px] font-bold rounded-full px-2.5 py-1"
            style={{ background: COLORS.lima, color: COLORS.ink }}
          >
            Alternativa
          </span>
        )}
        <span className="shrink-0 self-end mb-1" style={{ color: COLORS.inkFaint }}><IconChevron size={18} /></span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-label="Contanos qué querés hacer">
        <TituloSeccion>¿Cuánto querés invertir?</TituloSeccion>
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
          Contanos cuánto y en cuánto tiempo lo querés sacar, y te mostramos alternativas para tu plazo y tu perfil. O elegí directo una inversión de la lista.
        </p>
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
          <input
            aria-label="Cuánto querés invertir, en pesos"
            className="v2-focus w-full rounded-2xl pl-8 pr-4 py-3 text-[18px] font-mono tabular-nums outline-none"
            style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            inputMode="decimal"
            placeholder="Monto en pesos (opcional)"
            value={montoTxt}
            onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
          />
        </div>
        {objetivos.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>¿Es para un objetivo tuyo?</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Para qué objetivo">
              {objetivos.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={objetivoId === o.id}
                  onClick={() => setObjetivoId(objetivoId === o.id ? null : o.id)}
                  className="v2-focus min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition-all duration-100 active:scale-[0.97]"
                  style={objetivoId === o.id
                    ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                    : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                >
                  {o.nombre}
                </button>
              ))}
            </div>
            {objetivo && <PlanDelObjetivo objetivo={objetivo} resultado={resultado} onUsar={(m) => setMontoTxt(formatThousands(String(Math.round(m))))} />}
          </div>
        )}

        {!(objetivo && objetivo.meses !== null) && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>¿En cuánto tiempo lo querés sacar?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="En cuánto tiempo lo querés sacar">
            {TIEMPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tiempo === t.id}
                onClick={() => setTiempo(tiempo === t.id ? null : t.id)}
                className="v2-focus min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition-all duration-100 active:scale-[0.97]"
                style={tiempo === t.id
                  ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                  : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        )}
      </section>

      <section className="flex flex-col" aria-label="Inversiones">
        <p className="text-[14px] leading-snug pb-2" style={{ color: COLORS.inkSoft }}>
          {resultado.items.some((i) => i.recomendado)
            ? <>Para plata que querés sacar en {TRAMOS[resultado.tramo]}, con tu perfil, estas son las alternativas y cómo repartirla. En cada parte elegís una. El plazo define en qué; tu perfil, cuánto. Con $50.000 o con $5.000.000, es lo mismo.</>
            : <>Hoy no tenemos alternativas para sugerirte con los datos al día. Igual podés mirar cada inversión.</>}
        </p>
        {resultado.items.map(fila)}
      </section>

      <AprendeCards recomendados={resultado.items.filter((i) => i.recomendado).map((i) => i.rec.producto.id)} />

      <CuantoPoner sugerencia={sugerencia} />

      {inflacionPersonal && (
        <section className="flex flex-col gap-2" aria-label="Tu inflación personal">
          <TituloSeccion>Tu inflación personal</TituloSeccion>
          <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
            Según en qué gastás y dónde vivís, lo que consumís subió cerca de{' '}
            <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{pct(inflacionPersonal.mensual * 100, 1)}</span> por mes en los últimos meses.
            El promedio oficial {inflacionPersonal.region === 'gba' ? 'de CABA y GBA' : 'del país'} fue{' '}
            <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{pct(inflacionPersonal.oficial * 100, 1)}</span>.
            Lo que más pesa en tus gastos: {inflacionPersonal.pesos.filter((p) => p.rubro !== 'general').slice(0, 2).map((p) => RUBROS.find((r) => r.id === p.rubro)?.nombre.toLowerCase()).join(' y ')}.
            Por eso comparamos contra la más alta de las dos.
          </p>
          <EstadoConfianza estado="estimado" />
        </section>
      )}

      <MercadoHoy mercado={mercado} />

      {abierta && (
        <FlujoInversion
          rec={abierta}
          mercado={mercado}
          usa={usa}
          sugerencia={sugerencia}
          montoDeseado={monto}
          horizonteMeses={horizonte}
          onCerrar={() => setAbierta(null)}
          onRegistrar={(previos) => { const t = abierta.producto.id; setAbierta(null); onRegistrar(t, objetivo ? { ...previos, objetivo: objetivo.id } : previos, true); }}
        />
      )}
    </div>
  );
}

/**
 * Qué hay que separar por mes para llegar al objetivo a tiempo, sin invertir y invirtiendo en
 * lo que hoy más rinde de las alternativas. Siempre un rango y marcado como estimado.
 */
function PlanDelObjetivo({
  objetivo, resultado, onUsar,
}: {
  objetivo: ObjetivoParaInvertir;
  resultado: ReturnType<typeof recomendar>;
  onUsar: (monto: number) => void;
}) {
  const elegido = resultado.items.find((i) => i.recomendado && i.rec.mejor.tem);
  const plan = objetivo.meses ? planDeObjetivo(objetivo.faltante, objetivo.meses, elegido?.rec.mejor.tem ?? null) : null;
  return (
    <div className="flex flex-col gap-1.5 pl-3.5 border-l-2" style={{ borderColor: COLORS.lima }}>
      <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
        Para “{objetivo.nombre}” te faltan <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(objetivo.faltante)}</span>
        {plan ? <> y tenés <span className="font-semibold" style={{ color: COLORS.ink }}>{objetivo.meses} {objetivo.meses === 1 ? 'mes' : 'meses'}</span>.</> : '.'}
      </p>
      {plan ? (
        <>
          <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
            Guardándolo sin invertir, serían unos <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(plan.sinInvertir)}</span> por mes.
            {plan.invirtiendo && elegido && (
              <> Si esa plata rinde en {elegido.rec.producto.nombre.toLowerCase()}, alcanzarían entre{' '}
                <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(plan.invirtiendo.min)}</span> y{' '}
                <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(plan.invirtiendo.max)}</span> por mes.</>
            )}
          </p>
          <EstadoConfianza estado="estimado" />
          {plan.invirtiendo && (
            <button
              type="button"
              onClick={() => onUsar(plan.invirtiendo!.max)}
              className="v2-focus self-start min-h-[44px] rounded-full px-4 text-[15px] font-bold"
              style={{ border: `1.5px solid ${COLORS.brand}`, color: COLORS.brand }}
            >
              Usar {fmtPesos(plan.invirtiendo.max)} por mes
            </button>
          )}
        </>
      ) : (
        <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>Ponele una fecha al objetivo y te decimos cuánto separar por mes.</p>
      )}
    </div>
  );
}

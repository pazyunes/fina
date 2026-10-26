import { useEffect, useMemo, useState } from 'react';
import { borrarPlanesDe, listarPlanes, type PlanGuia } from '../../../api/v2/planes';
import type { PosicionInversion } from '../../../api/v2/tipos';
import type { PerfilRiesgo, ProductoId, ProveedorId } from '../../../lib/inversiones/catalogo';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import type { InflacionPersonal } from '../../../lib/inversiones/inflacionPersonal';
import { hayFallaEsencial, MENSAJE_DE_ERROR } from '../../../lib/inversiones/estadoDatos';
import { planDeObjetivo, type ObjetivoParaInvertir } from '../../../lib/inversiones/objetivos';
import { fmtPesos } from '../../../lib/inversiones/formato';
import { MAX_USD, maxPesos } from '../../../lib/inversiones/limites';
import { recomendar, type ItemProducto, type Recomendacion } from '../../../lib/inversiones/motor';
import { useMercado } from '../../../lib/inversiones/useMercado';
import { IconChevron, IconClose } from '../FinaIcons';
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

// La pestaña de alternativas. La persona puede contar cuánto quiere invertir (en pesos o en dólares) y en cuánto tiempo lo
// quiere sacar, y se muestran sólo las alternativas que hoy encajan con su plazo y su perfil, con la parte de la plata que
// le corresponde a cada una; las demás están detrás de "Ver más". O puede elegir directo una inversión.
// Todo sale de los datos de mercado de hoy: sin datos, no hay nada que sugerir.
const TIP_CERRADO = 'fina_inv_tip_cerrado';

export function RecomendacionesTab({
  perfil, horizonteMeses, usa, propias, posiciones, productosQuiz, sugerencia, gastoCercano, objetivoEnDolares, inflacionPersonal, objetivos, onVerMias,
}: {
  perfil: PerfilRiesgo;
  horizonteMeses: number | null;
  usa: ProveedorId[];
  /** Los bancos y billeteras que usa (por lo que contó y por sus medios de pago). */
  propias: string[];
  posiciones: PosicionInversion[];
  /** Lo que dijo en el quiz que ya hace, además de lo que tiene registrado. */
  productosQuiz: ProductoId[];
  sugerencia: SugerenciaMonto;
  /** Tiene un gasto cercano que no alcanza a cubrir con lo que ingresa: se suma un fondo de garantía. */
  gastoCercano: boolean;
  /** Tiene un objetivo en dólares: sólo así el dólar entra entre las alternativas. */
  objetivoEnDolares: boolean;
  /** Lo que subió lo que esta persona consume, si se pudo calcular (se usa para comparar, no se muestra). */
  inflacionPersonal: InflacionPersonal | null;
  /** Los objetivos para los que se podría invertir (en pesos, con algo por juntar). */
  objetivos: ObjetivoParaInvertir[];
  /** Termina un paso a paso y lleva a "Mis inversiones". */
  onVerMias: () => void;
}) {
  const { estado, reintentar } = useMercado();
  // Arranca con lo que sobró el mes pasado: lo sugerido es invertirlo todo.
  const [montoTxt, setMontoTxt] = useState(() => (sugerencia.primero ? formatThousands(String(sugerencia.primero)) : ''));
  const [enUsd, setEnUsd] = useState(false);
  const [tiempo, setTiempo] = useState<string | null>(null);
  const [objetivoId, setObjetivoId] = useState<string | null>(null);
  const objetivo = objetivos.find((o) => o.id === objetivoId) ?? null;
  const [abierta, setAbierta] = useState<Recomendacion | null>(null);
  const [verMas, setVerMas] = useState(false);
  const [tipCerrado, setTipCerrado] = useState(() => { try { return localStorage.getItem(TIP_CERRADO) === '1'; } catch { return false; } });
  const [pendientes, setPendientes] = useState<PlanGuia[]>([]);

  const mercado = estado.tipo === 'listo' ? estado.mercado : null;
  const mep = mercado?.dolar.mep?.valor ?? mercado?.dolar.oficial?.valor ?? null;
  const montoIngresado = parseMoneyInput(montoTxt) || null;
  // Siempre se calcula en pesos: si lo puso en dólares, se pasa con el MEP de hoy.
  const monto = montoIngresado ? (enUsd ? (mep ? Math.round(montoIngresado * mep) : null) : montoIngresado) : null;
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

  // Los paso a paso que dejó a la mitad: se leen al entrar y cada vez que cierra uno.
  useEffect(() => {
    let vivo = true;
    void listarPlanes().then((p) => { if (vivo) setPendientes(p); });
    return () => { vivo = false; };
  }, [abierta]);

  const cerrarTip = () => { setTipCerrado(true); try { localStorage.setItem(TIP_CERRADO, '1'); } catch { /* sin almacenamiento, vuelve a aparecer */ } };
  const cambiarMonto = (txt: string) => {
    const f = formatThousands(txt);
    const n = parseMoneyInput(f);
    // Nada de números extremos: hasta US$ 1.000.000 (o su equivalente en pesos).
    if (n > (enUsd ? MAX_USD : maxPesos(mercado))) return;
    setMontoTxt(f);
  };

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Trayendo los datos de hoy">
        {[0, 1, 2].map((i) => <div key={i} className="h-[64px] rounded-2xl" style={{ background: COLORS.tint }} />)}
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

  const recomendadas = resultado.items.filter((i) => i.recomendado);
  const otras = resultado.items.filter((i) => !i.recomendado);
  const visibles = recomendadas.length > 0 && !verMas ? recomendadas : resultado.items;

  const fila = (it: ItemProducto) => {
    const r = it.rec;
    return (
      <button
        key={r.producto.id}
        type="button"
        onClick={() => setAbierta(r)}
        className="v2-focus relative w-full text-left flex items-center gap-3 py-3 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
        style={{ borderColor: COLORS.line }}
      >
        <span className="flex-1 min-w-0 flex flex-col gap-0.5 pr-20">
          <span className="font-bold text-[16px]" style={{ color: COLORS.ink }}>{r.producto.nombre}</span>
          {it.recomendado && it.peso !== null && (
            <span className="text-[13px] font-semibold leading-snug" style={{ color: COLORS.ink }}>
              Para el <span className="font-mono tabular-nums">{Math.round(it.peso * 100)}%</span> de tu plata{it.parte ? <> · {it.parte}</> : null}
              {monto ? <> (unos <span className="font-mono tabular-nums">{fmtPesos(monto * it.peso)}</span>)</> : null}
            </span>
          )}
          {it.recomendado && it.peso === null && it.parte && (
            <span className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>Reserva opcional, sin porcentaje · {it.parte}</span>
          )}
          {it.motivo && <span className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>{it.motivo}</span>}
        </span>
        {it.recomendado && (
          <span className="absolute top-2.5 right-6 text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: COLORS.lima, color: COLORS.ink }}>
            Alternativa
          </span>
        )}
        <span className="shrink-0 self-center" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
      </button>
    );
  };

  const campoMini = { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` };
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2.5" aria-label="Contanos qué querés hacer">
        {!tipCerrado && (
          <div className="flex items-start gap-2 rounded-2xl px-3 py-2" style={{ background: COLORS.tint }}>
            <p className="flex-1 text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Contanos cuánto y en cuánto tiempo lo querés sacar, y te mostramos alternativas para tu plazo y tu perfil.
            </p>
            <button type="button" onClick={cerrarTip} aria-label="Cerrar este aviso" className="v2-focus w-8 h-8 -mr-1 -mt-1 rounded-full flex items-center justify-center shrink-0" style={{ color: COLORS.inkSoft }}>
              <IconClose size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <label htmlFor="inv-monto" className="text-[12px] font-bold" style={{ color: COLORS.inkFaint }}>Monto</label>
            <div className="flex">
              <div className="relative flex-1 min-w-0">
                <span className="absolute top-1/2 -translate-y-1/2 left-3 text-[14px]" style={{ color: COLORS.inkSoft }}>{enUsd ? 'US$' : '$'}</span>
                <input
                  id="inv-monto"
                  inputMode="decimal"
                  maxLength={15}
                  className={`v2-focus w-full rounded-l-xl ${enUsd ? 'pl-11' : 'pl-7'} pr-2 py-2 text-[15px] font-mono tabular-nums outline-none`}
                  style={campoMini}
                  placeholder="Monto"
                  value={montoTxt}
                  onChange={(e) => cambiarMonto(e.target.value)}
                />
              </div>
              <select
                aria-label="Moneda"
                value={enUsd ? 'USD' : 'ARS'}
                onChange={(e) => { setEnUsd(e.target.value === 'USD'); setMontoTxt(''); }}
                className="v2-focus rounded-r-xl px-1.5 text-[13px] font-bold outline-none"
                style={{ ...campoMini, borderLeft: 'none' }}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          {!(objetivo && objetivo.meses !== null) && (
            <div className="w-[46%] flex flex-col gap-1">
              <label htmlFor="inv-plazo" className="text-[12px] font-bold" style={{ color: COLORS.inkFaint }}>¿En cuánto tiempo lo querés sacar?</label>
              <select
                id="inv-plazo"
                value={tiempo ?? ''}
                onChange={(e) => setTiempo(e.target.value || null)}
                className="v2-focus w-full rounded-xl px-2 py-2 text-[14px] outline-none"
                style={campoMini}
              >
                <option value="">Elegí un plazo</option>
                {TIEMPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}
        </div>
        {enUsd && montoIngresado && mep ? (
          <p className="text-[12px]" style={{ color: COLORS.inkFaint }}>Son unos <span className="font-mono tabular-nums">{fmtPesos(montoIngresado * mep)}</span> al dólar MEP de hoy.</p>
        ) : null}

        {objetivos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-bold" style={{ color: COLORS.inkFaint }}>¿Es para un objetivo tuyo?</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Para qué objetivo">
              {objetivos.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={objetivoId === o.id}
                  onClick={() => setObjetivoId(objetivoId === o.id ? null : o.id)}
                  className="v2-focus min-h-[36px] rounded-full px-3 text-[13px] font-semibold transition-all duration-100 active:scale-[0.97]"
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
      </section>

      <section className="flex flex-col" aria-label="Inversiones">
        {recomendadas.length === 0 && (
          <p className="text-[13px] leading-snug pb-2" style={{ color: COLORS.inkSoft }}>Hoy no tenemos alternativas para sugerirte con los datos al día. Igual podés mirar cada inversión.</p>
        )}
        {visibles.map(fila)}
        {recomendadas.length > 0 && otras.length > 0 && (
          <button
            type="button"
            onClick={() => setVerMas(!verMas)}
            aria-expanded={verMas}
            className="v2-focus self-start min-h-[44px] text-[14px] font-bold"
            style={{ color: COLORS.brand }}
          >
            {verMas ? 'Ver menos' : `Ver más (${otras.length})`}
          </button>
        )}
      </section>

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="Pendientes">
          <p className="text-[13px] font-bold" style={{ color: COLORS.inkFaint }}>Pendientes</p>
          {pendientes.map((pl) => {
            const item = resultado.items.find((i) => i.rec.producto.id === pl.producto);
            if (!item) return null;
            return (
              <div key={`${pl.producto}-${pl.proveedor}`} className="flex items-center gap-2 py-2 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <button type="button" onClick={() => setAbierta(item.rec)} className="v2-focus flex-1 min-w-0 text-left flex flex-col">
                  <span className="font-bold text-[15px]" style={{ color: COLORS.ink }}>{item.rec.producto.nombre}</span>
                  <span className="text-[12px]" style={{ color: COLORS.inkSoft }}>{pl.hechos.length} {pl.hechos.length === 1 ? 'paso hecho' : 'pasos hechos'} · seguir donde quedaste</span>
                </button>
                <button
                  type="button"
                  onClick={() => { void borrarPlanesDe(pl.producto).then(() => setPendientes((p) => p.filter((x) => x.producto !== pl.producto))); }}
                  className="v2-focus min-h-[40px] px-2 text-[13px] font-semibold"
                  style={{ color: COLORS.inkSoft }}
                  aria-label={`Cancelar el pendiente de ${item.rec.producto.nombre}`}
                >
                  Cancelar
                </button>
              </div>
            );
          })}
        </section>
      )}

      <AprendeCards recomendados={recomendadas.map((i) => i.rec.producto.id)} />

      <CuantoPoner sugerencia={sugerencia} />

      <MercadoHoy mercado={mercado} />

      {abierta && (
        <FlujoInversion
          rec={abierta}
          mercado={mercado}
          usa={usa}
          propias={propias}
          montoDeseado={monto}
          horizonteMeses={horizonte}
          onCerrar={() => setAbierta(null)}
          onVerMias={onVerMias}
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

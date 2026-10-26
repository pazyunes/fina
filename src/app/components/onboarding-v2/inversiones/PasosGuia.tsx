import { useState } from 'react';
import type { TipoPosicion } from '../../../api/v2/tipos';
import { CEDEARS_DISPONIBLES, listaDeCedears, MAX_UNIDADES, MAX_USD, maxPesos, precioCedear } from '../../../lib/inversiones/limites';
import { fmtPesos } from '../../../lib/inversiones/formato';
import type { Guia, PasoGuia } from '../../../lib/inversiones/guias';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { leerNumero, soloNumeros, type Borrador, type Valores } from '../../../lib/inversiones/registro';
import { COLORS, Cta, formatThousands, parseMoneyInput } from '../shared';
import { Felicitaciones } from './Felicitaciones';
import { FormularioRegistro } from './FormularioRegistro';
import { Hoja, ProgresoPasos } from './Hoja';

/** Una opción para elegir dónde hacerlo: un banco, una cuenta o un broker. */
export type OpcionDonde = {
  id: string;
  nombre: string;
  /** Una línea con lo que rinde, si se sabe. */
  detalle?: string;
  /** Una advertencia corta ("hoy rinde menos que la inflación"). */
  aviso?: string | null;
  /** La persona ya tiene cuenta ahí. */
  recomendado: boolean;
};

export type PropsPasos = {
  guia: Guia;
  tipoPosicion: TipoPosicion;
  mercado: Mercado;
  hechos: number[];
  actual: number;
  terminado: boolean;
  onIr: (i: number) => void;
  onHecho: (i: number, paso: PasoGuia) => void;
  onDeshacer: (i: number) => void;
  /** Volver a la última pantalla de la explicación. */
  onVolverAExplicacion: () => void;
  onCerrar: () => void;
  // dónde
  opcionesDonde: OpcionDonde[];
  seleccionDonde: string | null;
  onElegirDonde: (id: string) => void;
  tieneCuenta: boolean | null;
  onTieneCuenta: (b: boolean) => void;
  // plazo (plazo fijo)
  plazos: number[];
  plazoDias: number | null;
  onPlazo: (d: number) => void;
  // CEDEAR
  ticker: string | null;
  cantidad: number | null;
  onTicker: (t: string | null) => void;
  onCantidad: (n: number | null) => void;
  // dólar
  dolares: number | null;
  onDolares: (d: number | null) => void;
  // tasa
  tasaAnotada: number | null;
  onDeclarar: (paso: PasoGuia, tna: number) => void;
  // registro
  previosRegistro: Partial<Valores>;
  bloqueadosRegistro: string[];
  onRegistrado: (b: Borrador) => void;
  nombreProducto: string;
  onVerMias: () => void;
};

// El paso a paso: UN paso por pantalla. Arriba, la flecha para volver, el título fijo y "Siguiente"; después una línea
// de círculos que se va rellenando (0/6, 1/6…). Cada paso dice CÓMO se hace, corto: la explicación de qué es la inversión
// ya se dio antes. Las elecciones (banco, plazo, cuál CEDEAR, la tasa) se hacen ahí mismo, y el último paso es el registro.
export function PasosGuia(p: PropsPasos) {
  const { guia, hechos, actual } = p;
  const total = guia.pasos.length;
  const paso = guia.pasos[actual];
  const hecho = hechos.includes(actual);
  const ultimo = actual === total - 1;

  const siguiente = !ultimo ? (
    <button type="button" onClick={() => p.onIr(actual + 1)} className="v2-focus min-h-[40px] px-3 text-[14px] font-bold shrink-0" style={{ color: COLORS.brand }}>
      Siguiente ›
    </button>
  ) : null;

  if (p.terminado) {
    return (
      <Hoja titulo={guia.titulo} onCerrar={p.onCerrar} ancho={460}>
        <Felicitaciones nombre={p.nombreProducto.toLowerCase()} onListo={p.onVerMias} />
      </Hoja>
    );
  }

  const listoParaMarcar = puedeMarcar(paso, p);

  return (
    <Hoja
      titulo={guia.titulo}
      onCerrar={p.onCerrar}
      ancho={460}
      onVolver={actual > 0 ? () => p.onIr(actual - 1) : p.onVolverAExplicacion}
      arriba={siguiente}
    >
      <ProgresoPasos total={total} hechos={hechos.length} actual={actual} />

      <div className="flex flex-col gap-3" key={paso.id}>
        <h3 className="text-[18px] font-bold leading-tight" style={{ color: COLORS.ink }}>
          <span className="font-mono tabular-nums" style={{ color: COLORS.brand }}>{actual + 1}. </span>{paso.titulo}
        </h3>

        {paso.haces && !paso.registra && <p className="text-[15px] leading-snug font-semibold" style={{ color: COLORS.ink }}>{paso.haces}</p>}
        {paso.puntos && paso.puntos.length > 0 && (
          <ul className="flex flex-col gap-1 list-disc pl-5">
            {paso.puntos.map((t) => <li key={t} className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{t}</li>)}
          </ul>
        )}
        {paso.atencion && (
          <p role="note" className="text-[14px] leading-snug pl-3 border-l-2" style={{ color: COLORS.ink, borderColor: COLORS.star }}>{paso.atencion}</p>
        )}
        {paso.datos && paso.datos.length > 0 && (
          <div className="flex flex-col pl-3 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
            {paso.datos.map((d) => (
              <p key={`${d.etiqueta}-${d.valor}`} className="text-[13px] leading-snug py-0.5" style={{ color: COLORS.inkSoft }}>
                {d.etiqueta}: <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{d.valor}</span>
              </p>
            ))}
          </div>
        )}

        {paso.widget === 'donde' && <ElegirDondeInline p={p} />}
        {paso.widget === 'plazo' && <ElegirPlazoInline p={p} />}
        {paso.widget === 'cedear' && <ElegirCedearInline p={p} />}
        {paso.widget === 'dolares' && <ElegirDolaresInline p={p} />}
        {paso.widget === 'tasa' && paso.declara && <DeclararTasa key={`${paso.id}-${p.tasaAnotada}`} anotada={p.tasaAnotada} onAnotar={(tna) => p.onDeclarar(paso, tna)} />}
        {paso.avanzado && <Avanzado titulo={paso.avanzado.titulo} texto={paso.avanzado.texto} />}
        {paso.widget === 'registro' && (
          <FormularioRegistro
            tipo={p.tipoPosicion}
            previos={p.previosRegistro}
            bloqueados={p.bloqueadosRegistro}
            mercado={p.mercado}
            onGuardado={p.onRegistrado}
          />
        )}

        {paso.chequeo && (
          <p className="text-[14px] leading-snug rounded-2xl px-3 py-2.5" style={{ background: COLORS.limaSoft, color: COLORS.ink }}>
            <span className="font-bold">Sabés que salió bien cuando </span>{lowerFirst(paso.chequeo)}
          </p>
        )}
      </div>

      {!paso.registra && paso.widget !== 'tasa' && (
        hecho ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold" style={{ color: COLORS.limaText }}>Hecho</span>
            <button type="button" onClick={() => p.onDeshacer(actual)} className="v2-focus min-h-[40px] text-[13px] font-semibold underline" style={{ color: COLORS.inkSoft }}>Marcar como pendiente</button>
          </div>
        ) : (
          <Cta label="Ya lo hice" disabled={!listoParaMarcar} onClick={() => p.onHecho(actual, paso)} />
        )
      )}
    </Hoja>
  );
}

const lowerFirst = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/** ¿Se puede marcar el paso como hecho? Los que piden elegir algo no se marcan sin elegirlo. */
function puedeMarcar(paso: PasoGuia, p: PropsPasos): boolean {
  switch (paso.widget) {
    case 'donde': return p.seleccionDonde !== null && p.tieneCuenta !== null;
    case 'plazo': return p.plazoDias !== null;
    case 'cedear': return !!p.ticker && !!p.cantidad && p.cantidad > 0;
    case 'dolares': return !!p.dolares && p.dolares > 0;
    default: return true;
  }
}

// ── dónde: el banco, la cuenta o el broker ───────────────────────────────
function ElegirDondeInline({ p }: { p: PropsPasos }) {
  const elegida = p.opcionesDonde.find((o) => o.id === p.seleccionDonde) ?? null;
  const ESTILO_SELECT = { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` };
  const etiqueta = (o: OpcionDonde) => `${o.recomendado ? '★ ' : ''}${o.nombre}${o.detalle ? ` — ${o.detalle}` : ''}${o.recomendado ? ' · recomendado: ya tenés cuenta' : ''}`;
  return (
    <div className="flex flex-col gap-2.5">
      {p.opcionesDonde.length > 6 ? (
        <select
          aria-label="Elegí uno"
          className="v2-focus w-full rounded-2xl px-3.5 py-3 text-[15px] outline-none"
          style={ESTILO_SELECT}
          value={p.seleccionDonde ?? ''}
          onChange={(e) => { if (e.target.value) p.onElegirDonde(e.target.value); }}
        >
          <option value="">Elegí uno</option>
          {p.opcionesDonde.map((o) => <option key={o.id} value={o.id}>{etiqueta(o)}</option>)}
        </select>
      ) : (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Elegí uno">
          {p.opcionesDonde.map((o) => {
            const sel = p.seleccionDonde === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => p.onElegirDonde(o.id)}
                className="v2-focus flex items-center justify-between gap-2 text-left rounded-2xl px-3.5 py-2.5 transition-all duration-100 active:scale-[0.99]"
                style={sel ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                <span className="text-[15px] font-bold">{o.nombre}</span>
                {o.recomendado && <span className="text-[12px] font-semibold rounded-full px-2 py-0.5" style={sel ? { background: COLORS.surface, color: COLORS.ink } : { background: COLORS.lima, color: COLORS.ink }}>Recomendado · ya tenés cuenta</span>}
              </button>
            );
          })}
        </div>
      )}
      {elegida?.aviso && <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{elegida.aviso}</p>}
      {elegida && (
        <div className="flex gap-2" role="radiogroup" aria-label="¿Ya tenés cuenta?">
          {[{ v: true, t: 'Ya tengo cuenta' }, { v: false, t: 'Me tengo que crear una' }].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={p.tieneCuenta === o.v}
              onClick={() => p.onTieneCuenta(o.v)}
              className="v2-focus flex-1 min-h-[42px] rounded-2xl text-[14px] font-bold transition-all duration-100 active:scale-[0.98]"
              style={p.tieneCuenta === o.v ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            >
              {o.t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── plazo (en días) ──────────────────────────────────────────────────────
function ElegirPlazoInline({ p }: { p: PropsPasos }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-bold" style={{ color: COLORS.inkFaint }}>¿Por cuántos días?</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Plazo en días">
        {p.plazos.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={p.plazoDias === d}
            onClick={() => p.onPlazo(d)}
            className="v2-focus flex-1 min-h-[42px] rounded-2xl text-[14px] font-bold transition-all duration-100 active:scale-[0.98]"
            style={p.plazoDias === d ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
          >
            {d} días
          </button>
        ))}
      </div>
    </div>
  );
}

// ── CEDEAR: cuál y cuántos ───────────────────────────────────────────────
function ElegirCedearInline({ p }: { p: PropsPasos }) {
  const precio = p.ticker ? precioCedear(p.mercado, p.ticker) : null;
  const populares = new Set(CEDEARS_DISPONIBLES.map((c) => c.ticker));
  const otros = listaDeCedears(p.mercado).filter((c) => !populares.has(c.ticker));
  const [cantTxt, setCantTxt] = useState(p.cantidad ? String(p.cantidad) : '');
  return (
    <div className="flex flex-col gap-2.5">
      <select
        aria-label="Qué CEDEAR"
        className="v2-focus w-full rounded-2xl px-3.5 py-3 text-[15px] outline-none"
        style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        value={p.ticker ?? ''}
        onChange={(e) => p.onTicker(e.target.value || null)}
      >
        <option value="">Elegí una opción</option>
        <optgroup label="Los más usados">
          {CEDEARS_DISPONIBLES.map((c) => <option key={c.ticker} value={c.ticker}>{c.ticker} · {c.nombre} (recomendado)</option>)}
        </optgroup>
        <optgroup label="Todos los demás">
          {otros.map((c) => <option key={c.ticker} value={c.ticker}>{c.ticker}</option>)}
        </optgroup>
      </select>
      <div className="flex flex-col gap-1">
        <label htmlFor="cedear-cantidad" className="text-[13px] font-bold" style={{ color: COLORS.inkFaint }}>¿Cuántos?</label>
        <input
          id="cedear-cantidad"
          inputMode="numeric"
          maxLength={9}
          placeholder="Ej: 2"
          value={cantTxt}
          onChange={(e) => {
            const t = soloNumeros(e.target.value).replace(/[.,]/g, '');
            setCantTxt(t);
            const n = t ? Number(t) : null;
            p.onCantidad(n !== null && n > 0 && n <= MAX_UNIDADES ? n : null);
          }}
          className="v2-focus w-full rounded-2xl px-3.5 py-2.5 text-[16px] font-mono tabular-nums outline-none"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        />
        {precio && (
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Cada uno cuesta <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(precio)}</span>
            {p.cantidad ? <> · total aprox. <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(precio * p.cantidad)}</span>, más la comisión</> : null}.
          </p>
        )}
      </div>
    </div>
  );
}

// ── dólar MEP: en pesos o en dólares ─────────────────────────────────────
function ElegirDolaresInline({ p }: { p: PropsPasos }) {
  const mep = p.mercado.dolar.mep?.valor ?? null;
  const [usd, setUsd] = useState(true);
  const [txt, setTxt] = useState(p.dolares ? formatThousands(String(Math.round(p.dolares))) : '');
  const tope = usd ? MAX_USD : maxPesos(p.mercado);
  const cambiar = (t: string, enUsd: boolean) => {
    const f = formatThousands(t);
    const n = parseMoneyInput(f);
    if (n > (enUsd ? MAX_USD : maxPesos(p.mercado))) return;
    setTxt(f);
    p.onDolares(n > 0 ? (enUsd ? n : mep ? n / mep : null) : null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2" role="radiogroup" aria-label="Moneda">
        {[{ v: true, t: 'En dólares' }, { v: false, t: 'En pesos' }].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={usd === o.v}
            onClick={() => { setUsd(o.v); setTxt(''); p.onDolares(null); }}
            className="v2-focus flex-1 min-h-[42px] rounded-2xl text-[14px] font-bold"
            style={usd === o.v ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` } : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
          >
            {o.t}
          </button>
        ))}
      </div>
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>{usd ? 'US$' : '$'}</span>
        <input
          aria-label={usd ? 'Cuántos dólares' : 'Cuántos pesos'}
          inputMode="decimal"
          maxLength={15}
          value={txt}
          onChange={(e) => cambiar(e.target.value, usd)}
          className={`v2-focus w-full rounded-2xl ${usd ? 'pl-12' : 'pl-8'} pr-3.5 py-2.5 text-[16px] font-mono tabular-nums outline-none`}
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
        />
      </div>
      <p className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>Máximo {usd ? `US$ ${MAX_USD.toLocaleString('es-AR')}` : fmtPesos(tope)}.</p>
    </div>
  );
}

// ── avanzado: cerrado, y se puede dejar para más adelante ────────────────
function Avanzado({ titulo, texto }: { titulo: string; texto: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-1.5" style={{ background: COLORS.tint }}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="v2-focus text-left text-[14px] font-bold" style={{ color: COLORS.brand }}>
        {titulo} {abierto ? '▴' : '▾'}
      </button>
      {abierto && (
        <>
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{texto}</p>
          <button type="button" onClick={() => setAbierto(false)} className="v2-focus self-start min-h-[36px] text-[13px] font-semibold underline" style={{ color: COLORS.inkSoft }}>Más adelante</button>
        </>
      )}
    </div>
  );
}

/**
 * "¿Qué tasa te muestra la app?" Billeteras y fondos no tienen una API con su tasa: lo que la persona ve en su pantalla
 * es el dato real, y le sirve a todos. Es obligatorio: sin la tasa no se puede calcular cuánto crece la plata. Al anotarla,
 * se pasa solo al paso siguiente.
 */
function DeclararTasa({ anotada, onAnotar }: { anotada: number | null; onAnotar: (tna: number) => void }) {
  const [txt, setTxt] = useState(anotada !== null ? String(Math.round(anotada * 10000) / 100).replace('.', ',') : '');
  const n = txt.trim() ? leerNumero(txt) : null;
  const valida = n !== null && n >= 1 && n <= 100;
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl p-3" style={{ background: COLORS.tint }}>
      <label htmlFor="declarar-tasa" className="text-[14px] font-bold" style={{ color: COLORS.ink }}>Tasa que te muestra la app (TNA)</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="declarar-tasa"
            inputMode="decimal"
            placeholder="Ej: 19"
            maxLength={6}
            value={txt}
            onChange={(e) => setTxt(soloNumeros(e.target.value))}
            className="v2-focus w-full rounded-2xl pl-3.5 pr-9 py-2.5 text-[16px] font-mono tabular-nums outline-none"
            style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
          />
          <span className="absolute top-1/2 -translate-y-1/2 right-3.5" style={{ color: COLORS.inkSoft }}>%</span>
        </div>
        <button
          type="button"
          disabled={!valida}
          onClick={() => { if (valida && n !== null) onAnotar(n / 100); }}
          className="v2-focus min-h-[44px] rounded-2xl px-4 text-[14px] font-bold"
          style={valida ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.inkFaint, border: `1.5px solid ${COLORS.lineStrong}` }}
        >
          Anotar
        </button>
      </div>
      <p className="text-[12px] leading-snug" style={{ color: COLORS.inkSoft }}>También lo encontrás como “rendimiento anual” o “tasa”. Si solo ves la TEA, anotá esa.</p>
    </div>
  );
}

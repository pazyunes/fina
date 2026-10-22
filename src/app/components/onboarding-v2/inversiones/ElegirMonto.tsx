import { useState } from 'react';
import type { ProductoId, ProveedorId } from '../../../lib/inversiones/catalogo';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { fmtPesos, nombrePropio, pct } from '../../../lib/inversiones/formato';
import { tasaDeBanco } from '../../../lib/inversiones/guias';
import { CEDEARS_DISPONIBLES, avisoDeMonto, entradaDe, explicarTicker, limitesDe, listaDeCedears, plazosDe, precioCedear } from '../../../lib/inversiones/limites';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import { soloNumeros } from '../../../lib/inversiones/registro';
import { BotonFantasma, COLORS, Cta, formatMontoInicial, formatThousands, parseMoneyInput, TituloSeccion } from '../shared';
import { Hoja, Parrafo } from './Hoja';

/** Lo que se decidió: es lo mismo que después se pregunta al registrar. */
export type Entradas = {
  monto: number | null;
  plazoDias: number | null;
  ticker: string | null;
  cantidad: number | null;
  dolares: number | null;
};

/** Monto de prueba cuando no sabemos cuánto le sobra: chico, para ver cómo funciona. */
export const MONTO_DE_PRUEBA = 10_000;

// Cuánto invertir. Cada inversión pide lo que de verdad se decide al hacerla:
//   · cuenta y fondo: un monto en pesos
//   · plazo fijo: un monto y por cuántos días
//   · CEDEAR: cuántos (se compran de a uno entero, cada uno con su precio)
//   · dólar: pesos o dólares, a elección
// Siempre se dice en qué moneda es, y el mínimo si lo hay.
export function ElegirMonto({
  producto, proveedor, banco, mercado, sugerencia, montoDeseado, inicial, onListo, onVolver, onCerrar,
}: {
  producto: ProductoId;
  proveedor: ProveedorId;
  banco: string | null;
  mercado: Mercado;
  sugerencia: SugerenciaMonto;
  /** Lo que escribió arriba, en "¿Cuánto querés invertir?". */
  montoDeseado: number | null;
  inicial: Entradas;
  onListo: (e: Entradas) => void;
  onVolver: () => void;
  onCerrar: () => void;
}) {
  const entrada = entradaDe(producto);
  const mep = mercado.dolar.mep?.valor ?? null;
  const base = montoDeseado ?? sugerencia.primero ?? MONTO_DE_PRUEBA;

  const [montoTxt, setMontoTxt] = useState(formatMontoInicial(inicial.monto ?? base));
  const [plazo, setPlazo] = useState<number>(inicial.plazoDias ?? plazosDe(producto)[0]);
  const [ticker, setTicker] = useState<string>(inicial.ticker ?? 'SPY');
  const precio = precioCedear(mercado, ticker);
  const [cantTxt, setCantTxt] = useState(String(inicial.cantidad ?? (precio ? Math.max(1, Math.floor(base / precio)) : 1)));
  const [modoUsd, setModoUsd] = useState(inicial.dolares !== null);
  const [dolaresTxt, setDolaresTxt] = useState(inicial.dolares !== null ? formatMontoInicial(inicial.dolares) : '');

  const monto = parseMoneyInput(montoTxt) || null;
  const cantidad = Number(soloNumeros(cantTxt).replace(',', '.')) || null;
  const dolares = parseMoneyInput(dolaresTxt) || null;
  const limites = limitesDe(producto, proveedor, mercado, ticker);

  // El monto que va a entrar, según lo que se pide en esta inversión.
  const total: number | null =
    entrada === 'cantidad' ? (cantidad && precio ? cantidad * precio : null)
      : entrada === 'dolares' ? (modoUsd ? (dolares && mep ? dolares * mep : null) : monto)
        : monto;
  const aviso = entrada === 'cantidad'
    ? (cantidad && !Number.isInteger(cantidad) ? { texto: 'Se compran de a uno entero.', bloquea: true } : null)
    : avisoDeMonto(limites, total);
  const listo = total !== null && total > 0 && !(aviso?.bloquea);

  const recomendado = sugerencia.primero
    ? `El mes pasado te sobraron ${fmtPesos(sugerencia.primero)}: una alternativa es invertirlo todo.`
    : entrada === 'cantidad' && precio
      ? `Una forma de probar cómo funciona es empezar con 1 (${fmtPesos(precio)}).`
      : `Una forma de probar cómo funciona es empezar con ${fmtPesos(MONTO_DE_PRUEBA)}.`;

  const tna = entrada === 'monto_plazo' ? tasaDeBanco(mercado, banco, plazo) : null;
  const interes = producto === 'plazo_fijo' && total && tna ? total * tna * (plazo / 365) : null;

  function seguir() {
    if (!listo) return;
    onListo({
      monto: total !== null ? Math.round(total) : null,
      plazoDias: entrada === 'monto_plazo' ? plazo : null,
      ticker: entrada === 'cantidad' ? ticker : null,
      cantidad: entrada === 'cantidad' ? cantidad : null,
      dolares: entrada === 'dolares' && modoUsd ? dolares : (entrada === 'dolares' && total && mep ? total / mep : null),
    });
  }

  const campo = 'v2-focus w-full rounded-2xl pl-8 pr-4 py-3 text-[18px] font-mono tabular-nums outline-none';
  const estiloCampo = { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` };

  return (
    <Hoja titulo="¿Con cuánto empezás?" onCerrar={onCerrar}>
      <Parrafo>{recomendado}</Parrafo>

      {entrada === 'cantidad' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <TituloSeccion>¿Cuál querés comprar?</TituloSeccion>
            <select
              aria-label="Qué CEDEAR"
              className="v2-focus w-full rounded-2xl px-4 py-3 text-[16px] outline-none"
              style={estiloCampo}
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            >
              <optgroup label="Los más conocidos">
                {CEDEARS_DISPONIBLES.map((c) => (
                  <option key={c.ticker} value={c.ticker}>{c.ticker} · {c.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Todos los demás que operan hoy">
                {listaDeCedears(mercado).slice(CEDEARS_DISPONIBLES.length).map((c) => (
                  <option key={c.ticker} value={c.ticker}>{c.ticker}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
              {listaDeCedears(mercado).find((c) => c.ticker === ticker)?.explicacion}. {explicarTicker}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <TituloSeccion>¿Cuántos?</TituloSeccion>
            <input
              aria-label="Cuántos CEDEARs"
              className={`${campo} pl-4`}
              style={estiloCampo}
              inputMode="numeric"
              value={cantTxt}
              onChange={(e) => setCantTxt(soloNumeros(e.target.value))}
            />
            {precio && (
              <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
                Cada uno cuesta <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(precio)}</span>
                {total ? <> · total aproximado <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(total)}</span> (en pesos, más la comisión del broker)</> : null}.
              </p>
            )}
          </div>
        </div>
      ) : entrada === 'dolares' ? (
        <div className="flex flex-col gap-2.5">
          <TituloSeccion>¿Cuánto querés comprar?</TituloSeccion>
          <div className="flex gap-2" role="radiogroup" aria-label="En qué moneda">
            {[{ id: false, label: 'Poner pesos' }, { id: true, label: 'Elegir dólares' }].map((o) => (
              <button
                key={String(o.id)}
                type="button"
                role="radio"
                aria-checked={modoUsd === o.id}
                onClick={() => setModoUsd(o.id)}
                className="v2-focus flex-1 min-h-[48px] rounded-2xl text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                style={modoUsd === o.id
                  ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                  : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{modoUsd ? 'US$' : '$'}</span>
            <input
              aria-label={modoUsd ? 'Cuántos dólares' : 'Cuántos pesos'}
              className={`${campo} ${modoUsd ? 'pl-14' : ''}`}
              style={estiloCampo}
              inputMode="decimal"
              value={modoUsd ? dolaresTxt : montoTxt}
              onChange={(e) => (modoUsd ? setDolaresTxt(formatThousands(e.target.value)) : setMontoTxt(formatThousands(e.target.value)))}
            />
          </div>
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            {modoUsd ? 'El monto es en dólares (US$).' : 'El monto es en pesos.'}
            {mep && total ? (modoUsd
              ? <> Eso son unos <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(total)}</span> al dólar MEP de hoy ({fmtPesos(mep)}).</>
              : <> Con eso comprás unos <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>US$ {(total / mep).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span> al dólar MEP de hoy ({fmtPesos(mep)}).</>) : null}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <TituloSeccion>¿Cuánto querés invertir?</TituloSeccion>
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              aria-label="Monto a invertir, en pesos"
              className={campo}
              style={estiloCampo}
              inputMode="decimal"
              placeholder="Monto"
              value={montoTxt}
              onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
            />
          </div>
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>El monto es en pesos.</p>
        </div>
      )}

      {entrada === 'monto_plazo' && (
        <div className="flex flex-col gap-2.5">
          <TituloSeccion>¿Por cuántos días?</TituloSeccion>
          <div className="flex gap-2" role="radiogroup" aria-label="Plazo en días">
            {plazosDe(producto).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={plazo === d}
                onClick={() => setPlazo(d)}
                className="v2-focus flex-1 min-h-[48px] rounded-2xl text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                style={plazo === d
                  ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                  : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
              >
                {d} días
              </button>
            ))}
          </div>
          {producto === 'plazo_fijo_uva' && <Parrafo>En el plazo fijo UVA el mínimo es de 90 días.</Parrafo>}
          {tna && (
            <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
              {banco ? nombrePropio(banco) : 'Ese banco'} paga hoy <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{pct(tna * 100, 1)}</span> anual por {plazo} días
              {interes ? <>: con tu monto cobrarías de interés unos <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(interes)}</span></> : null}.
            </p>
          )}
        </div>
      )}

      {limites.textoMin && (
        <p className="text-[14px] leading-snug pl-3.5 border-l-2" style={{ color: aviso ? COLORS.naranjaText : COLORS.inkSoft, borderColor: aviso ? COLORS.naranja : COLORS.line }}>
          {limites.textoMin}
        </p>
      )}
      {aviso && aviso.texto !== limites.textoMin && (
        <p role="alert" className="text-[14px] leading-snug font-semibold" style={{ color: COLORS.naranjaText }}>{aviso.texto}</p>
      )}
      {limites.textoMax && <Parrafo>{limites.textoMax}</Parrafo>}

      <div className="flex flex-col gap-2">
        <Cta label="Continuar" disabled={!listo} onClick={seguir} />
        <BotonFantasma label="Atrás" onClick={onVolver} />
      </div>
    </Hoja>
  );
}

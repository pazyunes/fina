// Las fuentes de datos de mercado y cómo se convierten en un `Mercado`.
//
// Cada fuente se pide por separado y falla por separado: si cae una, el resto
// del paquete sale igual y la que falló queda anotada en `fallas`. Nunca se
// inventa un valor para tapar un hueco.
//
// FUENTES (verificadas contra las APIs reales el 21/10/2026):
//   · ArgentinaDatos (API comunitaria, NO oficial): inflación INDEC, UVA, plazo
//     fijo por banco, fondos de CAFCI con valor de cuotaparte diario, cuentas
//     remuneradas de billeteras, letras del Tesoro, riesgo país, histórico del MEP.
//   · BCRA, API de estadísticas v4 (oficial): TAMAR, BADLAR, inflación esperada (REM).
//     La v3 fue dada de baja (devuelve 410).
//   · DolarAPI: cotizaciones del dólar. Bluelytics, como segunda fuente para chequearlo.
//   · BYMA Open Data (el mercado, oficial y gratuito): precios de CEDEARs. data912
//     (comunitaria) queda como segunda fuente para chequearlos.
//   · datos.gob.ar (donde publica el INDEC): índices de precios, por rubro y por
//     región, y el nivel general para chequear la inflación mensual.
//   · Yahoo Finance (NO oficial): el S&P 500 en dólares, para decir qué rindió a largo plazo.
// Lo comunitario es el punto débil: por eso lo que baja se guarda (ver
// mercado.ts) y se muestra siempre con su fecha.

import { SERIES_IPC, type RegionIpc } from '../../src/app/lib/inversiones/ipc.js';
import type {
  CedearMercado, CuentaMercado, Dato, FondoMercado, IpcRubros, LetraMercado, Mercado, PlazoFijoBanco, SpyEstadisticas,
} from '../../src/app/lib/inversiones/mercadoTipos.js';
import { chequear, type Controles } from './chequeos.js';

const AD = 'https://api.argentinadatos.com/v1';
const BCRA = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias';
const MS_DIA = 24 * 60 * 60 * 1000;

// ── utilidades ───────────────────────────────────────────────────────────
async function traer<T>(url: string, ms = 9000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const esNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** 'YYYY-MM-DD' de hoy en Argentina. */
export function hoyAR(ahora: number = Date.now()): string {
  return new Date(ahora).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

function sumarDiasISO(fecha: string, dias: number): string {
  const t = new Date(`${fecha}T12:00:00Z`).getTime() + dias * MS_DIA;
  return new Date(t).toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / MS_DIA);
}

const sinNulos = <T,>(x: T | null | undefined): x is T => x !== null && x !== undefined;

// ── inflación ────────────────────────────────────────────────────────────
type Punto = { fecha: string; valor: number };

async function inflacionMeses(): Promise<{ fecha: string; valor: number }[]> {
  const todos = await traer<Punto[]>(`${AD}/finanzas/indices/inflacion`);
  return todos.filter((p) => esNum(p.valor)).slice(-12);
}

function interanual(meses: { valor: number }[]): number | null {
  if (meses.length < 12) return null;
  const f = meses.slice(-12).reduce((acc, m) => acc * (1 + m.valor / 100), 1);
  return (f - 1) * 100;
}

async function uva30d(hoy: string): Promise<Dato<number> | null> {
  const serie = await traer<Punto[]>(`${AD}/finanzas/indices/uva`);
  // La UVA se publica por adelantado: hay valores con fecha futura. Se usa el último ya vigente.
  const vigentes = serie.filter((p) => esNum(p.valor) && p.fecha <= hoy);
  const ultimo = vigentes[vigentes.length - 1];
  if (!ultimo) return null;
  const objetivo = sumarDiasISO(ultimo.fecha, -30);
  let base: Punto | undefined;
  for (let i = vigentes.length - 1; i >= 0; i--) {
    if (vigentes[i].fecha <= objetivo) { base = vigentes[i]; break; }
  }
  if (!base) return null;
  return { valor: (ultimo.valor / base.valor - 1) * 100, fecha: ultimo.fecha, fuente: 'UVA, BCRA (vía ArgentinaDatos)' };
}

// ── BCRA ─────────────────────────────────────────────────────────────────
type RespBcra = { results?: { detalle?: { fecha: string; valor: number }[] }[] };

async function bcra(id: number, fuente: string): Promise<Dato<number> | null> {
  const r = await traer<RespBcra>(`${BCRA}/${id}?limit=1`);
  const d = r.results?.[0]?.detalle?.[0];
  if (!d || !esNum(d.valor)) return null;
  return { valor: d.valor, fecha: d.fecha, fuente };
}

// ── fondos (CAFCI vía ArgentinaDatos) ────────────────────────────────────
type FilaFondo = { fondo: string; fecha: string; vcp: number };

// Los fondos que usan las billeteras y brokers que FINA cubre hoy.
const FONDOS_MONEY_MARKET = [
  'Mercado Fondo - Clase A',
  'Cocos Ahorro - Clase A',
  'Balanz Capital Money Market - Clase A',
];

function tnaDesde(actual: FilaFondo, previo: FilaFondo | undefined): number | null {
  if (!previo || !esNum(previo.vcp) || previo.vcp <= 0) return null;
  const dias = diasEntre(previo.fecha, actual.fecha);
  if (dias <= 0) return null;
  return (actual.vcp / previo.vcp - 1) * (365 / dias);
}

async function fondos(): Promise<Dato<FondoMercado[]> | null> {
  const ultimo = await traer<FilaFondo[]>(`${AD}/finanzas/fci/mercadoDinero/ultimo`);
  const elegidos = ultimo.filter((f) => FONDOS_MONEY_MARKET.includes(f.fondo));
  if (elegidos.length === 0) return null;
  const fechaUlt = elegidos[0].fecha;

  // Ayer contra hoy sí se puede pedir completo. La historia más larga NO: el
  // histórico por fecha de ArgentinaDatos trae sólo algunos fondos (no los
  // nuestros) y CAFCI bloquea las consultas automáticas. Por eso 7 y 30 días los
  // arma FINA con sus propias fotos diarias (ver `completarConHistoria`).
  const penultimo = await traer<FilaFondo[]>(`${AD}/finanzas/fci/mercadoDinero/penultimo`).catch(() => null);
  const salida: FondoMercado[] = elegidos.map((f) => ({
    id: f.fondo,
    fecha: f.fecha,
    vcp: f.vcp,
    tna1: tnaDesde(f, penultimo?.find((p) => p.fondo === f.fondo)),
    tna7: null,
    tna30: null,
  }));
  return { valor: salida, fecha: fechaUlt, fuente: 'CAFCI (vía ArgentinaDatos), valor de cuotaparte' };
}

// ── cuentas remuneradas de billeteras y bancos ───────────────────────────
type FilaCuenta = { fondo: string; tna: number; tea?: number; tope?: number; condiciones?: string; fecha: string };

async function cuentas(): Promise<Dato<CuentaMercado[]> | null> {
  const filas = await traer<FilaCuenta[]>(`${AD}/finanzas/fci/otros/ultimo`);
  const salida: CuentaMercado[] = filas
    .filter((f) => esNum(f.tna))
    .map((f) => ({
      id: f.fondo,
      tna: f.tna,
      tea: esNum(f.tea) ? f.tea : null,
      tope: esNum(f.tope) && f.tope > 0 ? f.tope : null,
      condiciones: f.condiciones ?? '',
      fecha: f.fecha,
    }));
  if (salida.length === 0) return null;
  const fecha = salida.map((c) => c.fecha).sort().pop() ?? salida[0].fecha;
  return { valor: salida, fecha, fuente: 'tasas publicadas por cada billetera (vía ArgentinaDatos)' };
}

// ── plazo fijo ───────────────────────────────────────────────────────────
type FilaPlazo = { entidad: string; tnaClientes: number | null; tasas?: { plazoMinDias: number | null; plazoMaxDias: number | null; tna: number }[] };

async function plazoFijo(hoy: string): Promise<Dato<PlazoFijoBanco[]> | null> {
  const filas = await traer<FilaPlazo[]>(`${AD}/finanzas/tasas/plazoFijo`);
  const salida: PlazoFijoBanco[] = filas
    .filter((f) => esNum(f.tnaClientes) && f.tnaClientes > 0)
    .map((f) => ({
      entidad: f.entidad,
      tnaClientes: f.tnaClientes as number,
      tasas: (f.tasas ?? [])
        .filter((t) => esNum(t.tna))
        .map((t) => ({ plazoMinDias: t.plazoMinDias ?? 0, plazoMaxDias: t.plazoMaxDias ?? 0, tna: t.tna })),
    }));
  if (salida.length === 0) return null;
  // La fuente no informa la fecha de cada tasa: es la de la consulta de hoy.
  return { valor: salida, fecha: hoy, fuente: 'tasas de plazo fijo publicadas por los bancos (BCRA, vía ArgentinaDatos), consultadas hoy' };
}

// ── letras del Tesoro ────────────────────────────────────────────────────
type RespLetras = {
  letras?: {
    ticker: string; tnaPorcentaje: number; temPorcentaje: number; fechaVencimiento: string;
    diasAlVencimiento: number; precioArs: number; monedaCupon?: string;
  }[];
  fechaActualizacion?: string;
};

async function letras(hoy: string): Promise<Dato<LetraMercado[]> | null> {
  const r = await traer<RespLetras>(`${AD}/finanzas/letras`);
  const salida: LetraMercado[] = (r.letras ?? [])
    // Las que ajustan por dólar u otra cosa muestran una "tasa" negativa que no es comparable con una en pesos.
    .filter((l) => l.monedaCupon === 'ARS' && esNum(l.tnaPorcentaje) && l.tnaPorcentaje > 0 && l.diasAlVencimiento > 0)
    .map((l) => ({
      ticker: l.ticker,
      tna: l.tnaPorcentaje / 100,
      tem: l.temPorcentaje / 100,
      vencimiento: l.fechaVencimiento,
      dias: l.diasAlVencimiento,
      precio: l.precioArs,
    }));
  if (salida.length === 0) return null;
  return { valor: salida, fecha: r.fechaActualizacion ? r.fechaActualizacion.slice(0, 10) : hoy, fuente: 'mercado de letras (vía ArgentinaDatos)' };
}

// ── CEDEARs ──────────────────────────────────────────────────────────────
const CEDEARS_DE_REFERENCIA = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'KO', 'MELI'];
type FilaCedear = { symbol: string; c: number; pct_change: number };
type FilaByma = { symbol: string; trade: number; previousClosingPrice: number; tradeVolume: number; denominationCcy: string };

/** BYMA devuelve varias filas por papel (según el plazo de liquidación): se toma la que más se operó. */
async function cedearsByma(hoy: string): Promise<Dato<CedearMercado[]> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/cedears', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 (FINA)' },
      body: JSON.stringify({ excludeZeroPxAndQty: true, T2: true, T1: false, T0: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`BYMA respondió ${res.status}`);
    const filas = (await res.json()) as FilaByma[];
    // Todos los CEDEARs que operan en pesos (son cientos), los de referencia primero. De cada uno, la fila más operada.
    const mejorPorSimbolo = new Map<string, FilaByma>();
    for (const f of filas) {
      if (f.denominationCcy !== 'ARS' || !esNum(f.trade) || f.trade <= 0 || typeof f.symbol !== 'string' || !/^[A-Z0-9.]{1,8}$/.test(f.symbol)) continue;
      const previa = mejorPorSimbolo.get(f.symbol);
      if (!previa || f.tradeVolume > previa.tradeVolume) mejorPorSimbolo.set(f.symbol, f);
    }
    const aMercado = (f: FilaByma): CedearMercado => ({
      simbolo: f.symbol,
      precio: f.trade,
      variacionDia: esNum(f.previousClosingPrice) && f.previousClosingPrice > 0 ? (f.trade / f.previousClosingPrice - 1) * 100 : 0,
    });
    const salida: CedearMercado[] = [
      ...CEDEARS_DE_REFERENCIA.map((s) => mejorPorSimbolo.get(s)).filter((f): f is FilaByma => !!f).map(aMercado),
      ...[...mejorPorSimbolo.values()].filter((f) => !CEDEARS_DE_REFERENCIA.includes(f.symbol)).sort((a, b) => a.symbol.localeCompare(b.symbol)).map(aMercado),
    ];
    if (salida.length === 0) return null;
    return { valor: salida, fecha: hoy, fuente: 'BYMA (el mercado), última operación' };
  } finally {
    clearTimeout(timer);
  }
}

/** La segunda fuente de precios: sólo para chequear que BYMA no esté dando algo raro. */
async function cedearsData912(): Promise<Record<string, number> | null> {
  const filas = await traer<FilaCedear[]>('https://data912.com/live/arg_cedears');
  const salida: Record<string, number> = {};
  for (const s of CEDEARS_DE_REFERENCIA) {
    const f = filas.find((x) => x.symbol === s);
    if (f && esNum(f.c) && f.c > 0) salida[s] = f.c;
  }
  return Object.keys(salida).length > 0 ? salida : null;
}

// ── dólar ────────────────────────────────────────────────────────────────
type FilaDolar = { casa: string; compra: number; venta: number; fechaActualizacion: string };

async function dolar(): Promise<Mercado['dolar']> {
  const filas = await traer<FilaDolar[]>('https://dolarapi.com/v1/dolares');
  const de = (casa: string): Dato<number> | null => {
    const f = filas.find((x) => x.casa === casa);
    if (!f || !esNum(f.venta)) return null;
    return { valor: f.venta, fecha: f.fechaActualizacion.slice(0, 10), fuente: 'DolarAPI, precio de venta' };
  };
  const oficial = de('oficial');
  const mep = de('bolsa');
  const brechaMep = oficial && mep ? (mep.valor / oficial.valor - 1) * 100 : null;

  let mep30d: number | null = null;
  try {
    const hist = await traer<{ fecha: string; venta: number }[]>(`${AD}/cotizaciones/dolares/bolsa`);
    const ultimo = hist[hist.length - 1];
    if (ultimo && esNum(ultimo.venta)) {
      const objetivo = sumarDiasISO(ultimo.fecha, -30);
      let base: { fecha: string; venta: number } | undefined;
      for (let i = hist.length - 1; i >= 0; i--) {
        if (hist[i].fecha <= objetivo) { base = hist[i]; break; }
      }
      if (base && esNum(base.venta) && base.venta > 0) mep30d = (ultimo.venta / base.venta - 1) * 100;
    }
  } catch {
    /* la variación es un extra: sin ella el dólar igual se muestra */
  }
  return { oficial, mep, ccl: de('contadoconliqui'), blue: de('blue'), brechaMep, mep30d };
}

async function riesgoPais(): Promise<Dato<number> | null> {
  const r = await traer<{ valor: number; fecha: string }>(`${AD}/finanzas/indices/riesgo-pais/ultimo`);
  if (!esNum(r.valor)) return null;
  return { valor: r.valor, fecha: r.fecha, fuente: 'riesgo país (vía ArgentinaDatos)' };
}

// ── segundas fuentes y datos nuevos ──────────────────────────────────────
/** Bluelytics: el mismo dólar por otro camino, para chequear a DolarAPI. */
async function bluelytics(): Promise<{ oficial: number | null; blue: number | null } | null> {
  const r = await traer<{ oficial?: { value_sell?: number }; blue?: { value_sell?: number } }>('https://api.bluelytics.com.ar/v2/latest');
  const oficial = esNum(r.oficial?.value_sell) ? r.oficial.value_sell : null;
  const blue = esNum(r.blue?.value_sell) ? r.blue.value_sell : null;
  return oficial === null && blue === null ? null : { oficial, blue };
}

/** Tasa promedio de depósitos a 30 días que publica el BCRA: un termómetro para las tasas de plazo fijo. */
const bcraPlazoFijo30 = (): Promise<Dato<number> | null> => bcra(12, 'Tasa de depósitos a 30 días, BCRA');

type RespSeries = { data?: (string | number | null)[][] };

/**
 * Índices del INDEC de un conjunto de series, últimos meses. Si el pedido junto
 * falla (la API rechaza todo si una serie no tiene datos), se pide de a una y se
 * saltean las que vienen vacías: un rubro que falta no tira abajo a los demás.
 */
async function seriesIndec(ids: string[], ultimos: number): Promise<Record<string, { fecha: string; valor: number }[]>> {
  const url = (lista: string[]) => `https://apis.datos.gob.ar/series/api/series?ids=${lista.join(',')}&last=${ultimos}&format=json`;
  const leer = (lista: string[], r: RespSeries): Record<string, { fecha: string; valor: number }[]> => {
    const salida: Record<string, { fecha: string; valor: number }[]> = {};
    lista.forEach((id, i) => {
      salida[id] = (r.data ?? []).flatMap((fila) => {
        const v = fila[i + 1];
        return esNum(v) ? [{ fecha: String(fila[0]), valor: v }] : [];
      });
    });
    return salida;
  };
  try {
    return leer(ids, await traer<RespSeries>(url(ids)));
  } catch {
    const partes = await Promise.all(ids.map(async (id) => {
      try {
        return leer([id], await traer<RespSeries>(url([id])));
      } catch {
        return { [id]: [] };
      }
    }));
    return Object.assign({}, ...partes) as Record<string, { fecha: string; valor: number }[]>;
  }
}

async function ipcRubros(): Promise<Dato<IpcRubros> | null> {
  const regiones: RegionIpc[] = ['nacional', 'gba'];
  const salida: IpcRubros = { nacional: {}, gba: {} };
  let ultima = '';
  const pedidos = await Promise.all(regiones.map((region) => seriesIndec(Object.values(SERIES_IPC[region]), 5)));
  for (const [i, region] of regiones.entries()) {
    const mapa = SERIES_IPC[region];
    const datos = pedidos[i];
    for (const [rubro, id] of Object.entries(mapa)) {
      const serie = datos[id] ?? [];
      if (serie.length > 0) salida[region][rubro] = serie;
    }
    const general = salida[region].general;
    if (general && general.length > 0 && general[general.length - 1].fecha > ultima) ultima = general[general.length - 1].fecha;
  }
  if (!ultima || !salida.nacional.general) return null;
  // El índice de un mes trae fecha del día 1, pero recién existe al terminar el mes: la frescura se mide desde el último día.
  const [anio, mes] = ultima.split('-').map(Number);
  const finDeMes = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return { valor: salida, fecha: finDeMes, fuente: 'índices de precios del INDEC (datos.gob.ar)' };
}

/** La inflación mensual del INDEC calculada de su propio índice, para chequear la que usamos. */
function controlDeInflacion(ipc: Dato<IpcRubros> | null): { fecha: string; valor: number }[] | null {
  const serie = ipc?.valor.nacional.general;
  if (!serie || serie.length < 2) return null;
  const salida: { fecha: string; valor: number }[] = [];
  for (let i = 1; i < serie.length; i++) {
    // Los índices vienen con fecha del primer día del mes: la variación se asigna a ese mes.
    salida.push({ fecha: serie[i].fecha, valor: (serie[i].valor / serie[i - 1].valor - 1) * 100 });
  }
  return salida;
}

type RespYahoo = {
  chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number }; indicators?: { adjclose?: { adjclose?: (number | null)[] }[] } }[] };
};

/** El S&P 500 (vía SPY) en dólares: precio de hoy, rendimiento anualizado de 10 años y el peor año. */
async function spyYahoo(): Promise<Dato<SpyEstadisticas> | null> {
  const r = await traer<RespYahoo>('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=10y&interval=1mo', 12000);
  const res = r.chart?.result?.[0];
  const serie = (res?.indicators?.adjclose?.[0]?.adjclose ?? []).filter((x): x is number => esNum(x) && x > 0);
  const precio = res?.meta?.regularMarketPrice;
  const t = res?.meta?.regularMarketTime;
  if (!esNum(precio) || !esNum(t) || serie.length < 60) return null;
  const anios = (serie.length - 1) / 12;
  const anualizado = (Math.pow(serie[serie.length - 1] / serie[0], 1 / anios) - 1) * 100;
  let peor: number | null = null;
  for (let i = 12; i < serie.length; i++) {
    const v = (serie[i] / serie[i - 12] - 1) * 100;
    if (peor === null || v < peor) peor = v;
  }
  return {
    valor: { precioUsd: precio, anualizado10a: anualizado, peorAnio: peor },
    fecha: new Date(t * 1000).toISOString().slice(0, 10),
    fuente: 'Yahoo Finance (no oficial)',
  };
}

// ── armado ───────────────────────────────────────────────────────────────
/** Corre una fuente; si falla la anota y devuelve el valor de repuesto. */
async function seguro<T>(nombre: string, fallas: string[], f: () => Promise<T>, vacio: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    // Queda en los logs de Vercel además de en las alertas: ahí se ve qué falló y por qué.
    console.error(`[mercado] la fuente "${nombre}" falló:`, motivo);
    fallas.push(`${nombre}: ${motivo}`);
    return vacio;
  }
}

export async function construirMercado(ahora: number = Date.now(), declaradas: Mercado['declaradas'] = {}): Promise<Mercado> {
  const hoy = hoyAR(ahora);
  const fallas: string[] = [];
  const dolarVacio: Mercado['dolar'] = { oficial: null, mep: null, ccl: null, blue: null, brechaMep: null, mep30d: null };

  const [meses, esperada, uva, tamar, badlar, pf, ctas, fci, lts, cedByma, usd, rp, ipc, spy, blu, pf30, ced912] = await Promise.all([
    seguro('inflación', fallas, inflacionMeses, []),
    seguro('inflación esperada (REM)', fallas, () => bcra(29, 'REM, BCRA: inflación esperada a 12 meses'), null),
    seguro('UVA', fallas, () => uva30d(hoy), null),
    seguro('TAMAR', fallas, () => bcra(44, 'TAMAR de bancos privados, BCRA'), null),
    seguro('BADLAR', fallas, () => bcra(7, 'BADLAR de bancos privados, BCRA'), null),
    seguro('plazo fijo', fallas, () => plazoFijo(hoy), null),
    seguro('cuentas remuneradas', fallas, cuentas, null),
    seguro('fondos', fallas, fondos, null),
    seguro('letras', fallas, () => letras(hoy), null),
    seguro('CEDEARs (BYMA)', fallas, () => cedearsByma(hoy), null),
    seguro('dólar', fallas, dolar, dolarVacio),
    seguro('riesgo país', fallas, riesgoPais, null),
    seguro('índices del INDEC', fallas, ipcRubros, null),
    seguro('S&P 500', fallas, spyYahoo, null),
    // Segundas fuentes: si fallan no es una falla de datos, sólo hay un chequeo menos.
    bluelytics().catch(() => null),
    bcraPlazoFijo30().catch(() => null),
    cedearsData912().catch(() => null),
  ]);

  // Si BYMA no respondió, se usa la fuente comunitaria como principal (y se dice).
  let ced = cedByma;
  if (!ced && ced912) {
    ced = {
      valor: Object.entries(ced912).map(([simbolo, precio]) => ({ simbolo, precio, variacionDia: 0 })),
      fecha: hoy,
      fuente: 'precios de mercado (data912, fuente comunitaria)',
    };
  }

  const mercado: Mercado = {
    generadoEn: new Date(ahora).toISOString(),
    desactualizado: false,
    inflacion: { meses, esperada12m: esperada, uva30d: uva, interanual: interanual(meses), control: controlDeInflacion(ipc) },
    tasas: { tamar, badlar },
    plazoFijo: pf,
    cuentas: ctas,
    fondos: fci,
    letras: lts,
    cedears: ced,
    dolar: usd,
    riesgoPais: rp,
    spy,
    ipc,
    declaradas,
    alertas: [],
    fallas,
  };
  const controles: Controles = { dolar: blu, plazoFijo30: pf30, cedears: ced912 };
  return { ...mercado, alertas: chequear(mercado, controles, ahora) };
}

/**
 * Una fuente que falla no tiene que borrar lo que ya teníamos: se conserva el
 * dato anterior CON SU FECHA ORIGINAL, y la regla de vigencia decide si todavía
 * sirve. Nunca se le cambia la fecha a un dato viejo.
 */
export function rellenarConAnterior(nuevo: Mercado, previo: Mercado | null): Mercado {
  if (!previo) return nuevo;
  return {
    ...nuevo,
    inflacion: {
      meses: nuevo.inflacion.meses.length > 0 ? nuevo.inflacion.meses : previo.inflacion.meses,
      esperada12m: nuevo.inflacion.esperada12m ?? previo.inflacion.esperada12m,
      uva30d: nuevo.inflacion.uva30d ?? previo.inflacion.uva30d,
      interanual: nuevo.inflacion.interanual ?? previo.inflacion.interanual,
      control: nuevo.inflacion.control ?? previo.inflacion.control,
    },
    tasas: {
      tamar: nuevo.tasas.tamar ?? previo.tasas.tamar,
      badlar: nuevo.tasas.badlar ?? previo.tasas.badlar,
    },
    plazoFijo: nuevo.plazoFijo ?? previo.plazoFijo,
    cuentas: nuevo.cuentas ?? previo.cuentas,
    fondos: nuevo.fondos ?? previo.fondos,
    letras: nuevo.letras ?? previo.letras,
    cedears: nuevo.cedears ?? previo.cedears,
    dolar: {
      oficial: nuevo.dolar.oficial ?? previo.dolar.oficial,
      mep: nuevo.dolar.mep ?? previo.dolar.mep,
      ccl: nuevo.dolar.ccl ?? previo.dolar.ccl,
      blue: nuevo.dolar.blue ?? previo.dolar.blue,
      brechaMep: nuevo.dolar.brechaMep ?? previo.dolar.brechaMep,
      mep30d: nuevo.dolar.mep30d ?? previo.dolar.mep30d,
    },
    riesgoPais: nuevo.riesgoPais ?? previo.riesgoPais,
    spy: nuevo.spy ?? previo.spy,
    ipc: nuevo.ipc ?? previo.ipc,
    declaradas: nuevo.declaradas,
  };
}

/**
 * Rellena el rendimiento de 7 y 30 días de los fondos con las fotos diarias que
 * FINA fue guardando. Cada foto trae el valor de cuotaparte de ese día, y con dos
 * valores y los días que pasaron entre uno y otro, el rendimiento sale exacto.
 * Mientras no haya fotos suficientes queda en null: nunca se estima.
 */
export function completarConHistoria(m: Mercado, fotos: Mercado[]): Mercado {
  if (!m.fondos) return m;
  const actual = m.fondos;
  const valor = actual.valor.map((f) => {
    const tnaContra = (diasMin: number): number | null => {
      // La foto más reciente que tenga al menos `diasMin` días de antigüedad.
      let mejor: { fecha: string; vcp: number } | null = null;
      for (const foto of fotos) {
        const previo = foto.fondos?.valor.find((x) => x.id === f.id);
        if (!previo || diasEntre(previo.fecha, f.fecha) < diasMin) continue;
        if (!mejor || previo.fecha > mejor.fecha) mejor = { fecha: previo.fecha, vcp: previo.vcp };
      }
      if (!mejor || mejor.vcp <= 0) return null;
      const dias = diasEntre(mejor.fecha, f.fecha);
      return dias > 0 ? (f.vcp / mejor.vcp - 1) * (365 / dias) : null;
    };
    return { ...f, tna7: tnaContra(7), tna30: tnaContra(30) };
  });
  return { ...m, fondos: { ...actual, valor } };
}

/** ¿Alcanza lo que se bajó para considerarlo un paquete válido? */
export function paqueteUtil(m: Mercado): boolean {
  const esenciales = [m.inflacion.meses.length > 0, m.fondos !== null, m.cuentas !== null, m.dolar.oficial !== null];
  return esenciales.filter(Boolean).length >= 2;
}

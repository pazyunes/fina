import type { Gasto, GastoFijo, Ingreso, Seccion } from '../api/v2/tipos';

// ─────────────────────────────────────────────────────────────────────────
// Objetivos: plazos, ritmo y formas de llegar antes (DEBT O1 e I7).
//
// Lógica pura, sin React ni Supabase y sin imports en tiempo de ejecución: la
// usan las pantallas (ObjetivosV2, ObjetivosEnInicio) y también el servidor
// (api/_notificaciones/plazos.ts), que la importa con extensión `.js` igual
// que a `api/v2/pasos.ts`. Por eso acá sólo hay `import type`.
//
// Reemplaza la versión de la v1, que leía el informe viejo (FinancialAnalysis)
// y devolvía "≈ 2 meses menos" con emoji. Ahora sale de lo que la persona
// registró de verdad, y todo lo que calculamos se devuelve como RANGO: es un
// estimado (frontend.md §5.1 y §5.2), nunca un número exacto.
//
// Los montos de aportes llegan YA en la moneda del objetivo: convertir es
// trabajo de quien llama (en el cliente, `enMoneda` de api/v2/conversion.ts).
// ─────────────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const SEMANAS_POR_MES = 4.33;

export type RangoNum = { min: number; max: number };

// ── Fechas ───────────────────────────────────────────────────────────────
// Todo en 'YYYY-MM-DD' y en días de Argentina, como la racha y los avisos.

const formatoAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function diaArgentina(instante: number = Date.now()): string {
  return formatoAR.format(new Date(instante));
}

const pad = (n: number) => String(n).padStart(2, '0');
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Días de `desde` a `hasta` (negativo si `hasta` ya pasó). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T12:00:00Z`);
  const b = Date.parse(`${hasta}T12:00:00Z`);
  return Math.round((b - a) / DIA_MS);
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

function fecha(anio: number, mes: number, dia: number): string | null {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return null;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null;
  if (!Number.isInteger(dia) || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

/**
 * El plazo de un objetivo, como 'YYYY-MM-DD', o null si no tiene uno con fecha.
 *
 * `goals.horizon_label` es texto libre. Lo que guarda la app hoy:
 *   · una fecha elegida en el calendario, con `toLocaleDateString('es-AR')`:
 *     "15 de marzo de 2027";
 *   · un preset sin fecha: "Lo antes posible", "Todavía no lo pensé".
 * Y lo que pudo quedar de antes o escribirse a mano: "marzo de 2027",
 * "marzo 2027", "dic 2026", "2027-03-15", "15/03/2027", "fin de año",
 * "diciembre", "2027".
 *
 * Cuando el texto dice sólo el mes, el plazo es el último día de ese mes;
 * sólo el año, el 31 de diciembre. Ante la duda se elige la fecha MÁS LEJANA
 * posible: un aviso de plazo que llega antes de tiempo es un reto.
 *
 * Los relativos ("en 6 meses", "1 año") devuelven null: no sabemos desde
 * cuándo cuentan, y adivinar daría avisos falsos. Lo que no se entiende,
 * también null: sin plazo no hay avisos de plazo.
 */
export function parsearHorizonte(label: string | null | undefined, hoy: string): string | null {
  if (!label) return null;
  const t = label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  const anioHoy = Number(hoy.slice(0, 4));
  const mesHoy = Number(hoy.slice(5, 7));

  // Relativos: sin ancla, sin plazo.
  if (/\b(en|dentro de)?\s*\d+\s*(dias?|semanas?|mes(es)?|anos?)\b/.test(t) && !/\b(19|20)\d{2}\b/.test(t)) return null;

  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return fecha(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return fecha(anio, Number(m[2]), Number(m[1]));
  }

  // "15 de marzo de 2027", "15 marzo 2027"
  m = t.match(/\b(\d{1,2}) (?:de )?([a-z]+) (?:de |del )?(\d{4})\b/);
  if (m && MESES[m[2]]) return fecha(Number(m[3]), MESES[m[2]], Number(m[1]));

  // "marzo de 2027", "dic 2026": último día del mes.
  m = t.match(/\b([a-z]+) (?:de |del )?(\d{4})\b/);
  if (m && MESES[m[1]]) {
    const anio = Number(m[2]);
    return fecha(anio, MESES[m[1]], diasDelMes(anio, MESES[m[1]]));
  }

  // "fin de año", "fin de ano"
  if (/\bfin(es)? de ano\b/.test(t)) return `${anioHoy}-12-31`;

  // Sólo el mes ("diciembre", "para marzo", "fines de julio"): el próximo.
  m = t.match(/^(?:para |en |a |fin(?:es)? de |principios de |mediados de )?([a-z]+)$/);
  if (m && MESES[m[1]]) {
    const mes = MESES[m[1]];
    const anio = mes >= mesHoy ? anioHoy : anioHoy + 1;
    return fecha(anio, mes, diasDelMes(anio, mes));
  }

  // Sólo el año: "2027", "para 2027", "en el 2027".
  m = t.match(/^(?:para |en |en el |a )?(\d{4})$/);
  if (m) return fecha(Number(m[1]), 12, 31);

  return null;
}

/** "15 de marzo de 2027", para mostrar un plazo que vino escrito de otra forma. */
export function fechaLarga(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ── Ritmo ────────────────────────────────────────────────────────────────

/** Un aporte con su monto ya en la moneda del objetivo. */
export type AporteEnMoneda = { monto: number; ts: number };

/** Lo sumado en los últimos 7 días: el delta de §5.3. Es un dato declarado. */
export function aporteDeLaSemana(aportes: AporteEnMoneda[], ahora: number): number {
  return aportes.filter((a) => a.ts >= ahora - 7 * DIA_MS && a.ts <= ahora).reduce((s, a) => s + a.monto, 0);
}

/**
 * Cuánto viene sumando por semana: el promedio de las últimas 4 semanas, o
 * desde el primer aporte si empezó hace menos (con un piso de una semana, para
 * que un aporte de ayer no se lea como un ritmo enorme). 0 si no sumó nada.
 */
export function ritmoSemanal(aportes: AporteEnMoneda[], ahora: number): number {
  const desde = ahora - 28 * DIA_MS;
  const recientes = aportes.filter((a) => a.ts >= desde && a.ts <= ahora);
  if (recientes.length === 0) return 0;
  const primero = Math.min(...aportes.map((a) => a.ts));
  const dias = Math.min(28, Math.max(7, (ahora - Math.max(primero, desde)) / DIA_MS));
  return recientes.reduce((s, a) => s + a.monto, 0) / (dias / 7);
}

/** Redondea para que un rango se lea como rango y no como un cálculo al peso. */
export function redondearLindo(n: number): number {
  if (n <= 0) return 0;
  const paso = n >= 100_000 ? 5_000 : n >= 20_000 ? 1_000 : n >= 2_000 ? 500 : n >= 200 ? 50 : 10;
  return Math.max(paso, Math.round(n / paso) * paso);
}

function rangoLindo(min: number, max: number): RangoNum {
  const a = redondearLindo(min);
  let b = redondearLindo(max);
  if (b <= a) b = redondearLindo(a * 1.2);
  return { min: a, max: b };
}

// ── Tiempo como rango ────────────────────────────────────────────────────

export type RangoTiempo = { min: number; max: number; unidad: 'semanas' | 'meses' };

/** De semanas sueltas a un rango que se pueda decir: "entre 2 y 3 semanas". */
export function rangoTiempo(semanasMin: number, semanasMax: number): RangoTiempo {
  const lo = Math.min(semanasMin, semanasMax);
  const hi = Math.max(semanasMin, semanasMax);
  if (hi < 9) {
    const min = Math.max(1, Math.floor(lo));
    return { min, max: Math.max(min + 1, Math.ceil(hi)), unidad: 'semanas' };
  }
  const min = Math.max(1, Math.floor(lo / SEMANAS_POR_MES));
  return { min, max: Math.max(min + 1, Math.ceil(hi / SEMANAS_POR_MES)), unidad: 'meses' };
}

export function textoTiempo(r: RangoTiempo): string {
  return `entre ${r.min} y ${r.max} ${r.unidad}`;
}

// ── Plazo: dónde está parada la persona ──────────────────────────────────

export type SituacionPlazo =
  | { tipo: 'sin-plazo' }
  | { tipo: 'cumplido' }
  /** El plazo ya pasó y todavía falta. No se reta: se ofrece mover la fecha. */
  | { tipo: 'vencido'; fecha: string }
  /** Al ritmo de ahora llega. */
  | { tipo: 'en-camino'; fecha: string; dias: number }
  /** Tiene plazo y todavía no sumó nada en las últimas semanas. */
  | { tipo: 'sin-aportes'; fecha: string; dias: number; porSemana: RangoNum }
  /** Viene sumando, pero a este ritmo no llega para la fecha. */
  | { tipo: 'no-llega'; fecha: string; dias: number; porSemana: RangoNum };

export function situacionPlazo(p: {
  horizonte: string | null | undefined;
  /** Lo que falta, en la moneda del objetivo. 0 = cumplido o sin monto. */
  restante: number;
  /** null = el objetivo no tiene monto: sin monto no hay cuenta que hacer. */
  montoTotal: number | null;
  ritmo: number;
  hoy: string;
}): SituacionPlazo {
  if (!p.montoTotal || p.montoTotal <= 0) return { tipo: 'sin-plazo' };
  if (p.restante <= 0) return { tipo: 'cumplido' };
  const fechaPlazo = parsearHorizonte(p.horizonte, p.hoy);
  if (!fechaPlazo) return { tipo: 'sin-plazo' };
  const dias = diasEntre(p.hoy, fechaPlazo);
  if (dias < 0) return { tipo: 'vencido', fecha: fechaPlazo };

  const semanas = Math.max(1, dias / 7);
  const necesario = p.restante / semanas;
  // Un rango y no un número: el plazo se cumple con "más o menos esto", y la
  // parte de arriba deja un margen para las semanas en que no se puede.
  const porSemana = rangoLindo(necesario, necesario * 1.25);
  if (p.ritmo <= 0) return { tipo: 'sin-aportes', fecha: fechaPlazo, dias, porSemana };
  if (p.ritmo * semanas < p.restante * 0.95) return { tipo: 'no-llega', fecha: fechaPlazo, dias, porSemana };
  return { tipo: 'en-camino', fecha: fechaPlazo, dias };
}

/**
 * Cuánto reservar por mes para llegar a la fecha con lo que falta. Misma
 * cuenta que `porSemana` en `situacionPlazo`, llevada a meses: un rango, con
 * margen arriba para los meses en que no se puede. Es un ESTIMADO (regla 4).
 * null si no hay fecha, no falta nada o la fecha ya pasó.
 */
export function reservaPorMes(p: { horizonte: string | null | undefined; restante: number; hoy: string }): { porMes: RangoNum; fecha: string } | null {
  if (p.restante <= 0) return null;
  const fecha = parsearHorizonte(p.horizonte, p.hoy);
  if (!fecha) return null;
  const dias = diasEntre(p.hoy, fecha);
  if (dias < 0) return null;
  const meses = Math.max(1, dias / 30.4);
  const necesario = p.restante / meses;
  return { porMes: rangoLindo(necesario, necesario * 1.25), fecha };
}

/** "Quedan 3 meses", "Quedan 5 semanas", "Es hoy": cuánto queda, como lo dice la gente. */
export function quedan(dias: number): string {
  if (dias <= 0) return 'Es hoy';
  if (dias === 1) return 'Queda 1 día';
  if (dias < 14) return `Quedan ${dias} días`;
  if (dias < 60) return `Quedan ${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30.4);
  return meses === 1 ? 'Queda 1 mes' : `Quedan ${meses} meses`;
}

export type MensajePlazo = {
  /** El dato. */
  texto: string;
  /** La salida, si hace falta una (§5.4: dato, contexto, salida). */
  salida: string | null;
  /** 'accion' = hay algo para hacer (naranja de relleno, nunca rojo) · 'logro' = va bien (lima) · 'neutral'. */
  tono: 'accion' | 'logro' | 'neutral';
  /** El rango por semana de la salida, para precargar el registro. En la moneda del objetivo. */
  porSemana: RangoNum | null;
};

/** Con menos de dos semanas, el monto por semana puede ser mucho: se ofrece también mover la fecha. */
function otraFecha(dias: number): string {
  return dias < 14 ? ' O elegí una fecha más lejana.' : '';
}

/**
 * Cómo se dice el plazo. Nunca reta: un objetivo atrasado es un dato con una
 * salida, no un error. `fmt` formatea en la moneda del objetivo.
 */
export function mensajePlazo(s: SituacionPlazo, fmt: (n: number) => string): MensajePlazo | null {
  switch (s.tipo) {
    case 'sin-aportes':
      return {
        texto: `${quedan(s.dias)} y no le apartaste nada en las últimas 4 semanas.`,
        salida: `Apartando entre ${fmt(s.porSemana.min)} y ${fmt(s.porSemana.max)} por semana, llegás para el ${fechaLarga(s.fecha)}.${otraFecha(s.dias)}`,
        tono: 'accion',
        porSemana: s.porSemana,
      };
    case 'no-llega':
      return {
        texto: `${quedan(s.dias)} y a este ritmo no llegás para el ${fechaLarga(s.fecha)}.`,
        salida: `Apartando entre ${fmt(s.porSemana.min)} y ${fmt(s.porSemana.max)} por semana, llegás.${otraFecha(s.dias)}`,
        tono: 'accion',
        porSemana: s.porSemana,
      };
    case 'en-camino':
      return { texto: `A este ritmo llegás para el ${fechaLarga(s.fecha)}.`, salida: null, tono: 'logro', porSemana: null };
    case 'vencido':
      return { texto: `La fecha ya pasó (${fechaLarga(s.fecha)}).`, salida: 'Elegí una nueva fecha.', tono: 'neutral', porSemana: null };
    default:
      return null;
  }
}

// ── Formas de llegar antes ───────────────────────────────────────────────

export type FormaDeLlegar = {
  id: string;
  titulo: string;
  /** El dato real del que sale la opción. */
  detalle: string;
  /** Cuánto más por semana, en la moneda del objetivo. Estimado. */
  extraSemanal: RangoNum;
  /**
   * 'antes' → `tiempo` es cuánto antes llega ("entre 2 y 3 semanas antes").
   * 'llega' → no viene sumando, así que `tiempo` es cuánto tardaría.
   */
  modo: 'antes' | 'llega';
  tiempo: RangoTiempo;
};

export type DatosFormas = {
  restante: number;
  ritmo: number;
  /** Cuántas unidades de la moneda del objetivo vale un peso (1 en ARS, 1/dólar en USD). null = no se puede convertir. */
  factor: number | null;
  /** Para formatear los montos en la moneda del objetivo. */
  fmtObjetivo: (n: number) => string;
  gastos: Gasto[];
  secciones: Seccion[];
  fijos: GastoFijo[];
  ingresos: Ingreso[];
  /** Secciones que la persona dijo que le gustaría recortar (onboarding). */
  preferidas: string[];
  ahora: number;
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const MENSUAL: Record<GastoFijo['frecuencia'], number> = { semanal: SEMANAS_POR_MES, quincenal: 2, mensual: 1, anual: 1 / 12 };

/**
 * Hasta 3 opciones concretas, armadas con lo que la persona registró: sus
 * secciones de gastos de los últimos 30 días, sus gastos fijos, sus ingresos y
 * lo que viene sumando. Cada una con su impacto en tiempo, como rango.
 *
 * Son opciones, no indicaciones: el texto dice qué pasa "si", nunca qué hacer.
 * Y no aparece una opción cuyo impacto sea menor a una semana: sería ruido.
 */
export function formasDeLlegarAntes(d: DatosFormas): FormaDeLlegar[] {
  if (d.factor === null || d.factor <= 0 || d.restante <= 0) return [];
  const factor = d.factor;
  const desde = d.ahora - 30 * DIA_MS;

  const impacto = (extraArsMin: number, extraArsMax: number): { modo: FormaDeLlegar['modo']; tiempo: RangoTiempo; extraSemanal: RangoNum } | null => {
    const xMin = extraArsMin * factor;
    const xMax = extraArsMax * factor;
    if (xMax <= 0) return null;
    const extraSemanal = { min: xMin, max: xMax };
    if (d.ritmo > 0) {
      const base = d.restante / d.ritmo;
      const ahorroMin = base - d.restante / (d.ritmo + xMin);
      const ahorroMax = base - d.restante / (d.ritmo + xMax);
      if (ahorroMax < 1) return null;
      return { modo: 'antes', tiempo: rangoTiempo(ahorroMin, ahorroMax), extraSemanal };
    }
    const tardaMin = d.restante / xMax;
    const tardaMax = d.restante / Math.max(xMin, xMax * 0.5);
    // Más de cinco años no es una forma de llegar: es otra conversación.
    if (tardaMin > 260) return null;
    return { modo: 'llega', tiempo: rangoTiempo(tardaMin, tardaMax), extraSemanal };
  };

  const candidatas: (FormaDeLlegar & { peso: number })[] = [];

  // 1) Secciones de gastos: un 10 a 20% menos en las que más se llevan.
  const preferidas = new Set(d.preferidas.map(normalizar));
  const porSeccion = d.secciones
    .map((s) => ({
      s,
      mes: d.gastos.filter((g) => g.seccionId === s.id && g.ts >= desde && g.ts <= d.ahora).reduce((t, g) => t + g.montoArs, 0),
    }))
    .filter((x) => x.mes >= 10_000)
    .sort((a, b) => {
      const pa = preferidas.has(normalizar(a.s.nombre)) || preferidas.has(normalizar(a.s.slug)) ? 1 : 0;
      const pb = preferidas.has(normalizar(b.s.nombre)) || preferidas.has(normalizar(b.s.slug)) ? 1 : 0;
      return pb - pa || b.mes - a.mes;
    })
    .slice(0, 2);
  for (const { s, mes } of porSeccion) {
    const semanal = mes / SEMANAS_POR_MES;
    const imp = impacto(semanal * 0.1, semanal * 0.2);
    if (!imp) continue;
    candidatas.push({
      id: `seccion:${s.id}`,
      titulo: `Gastar entre 10% y 20% menos en ${s.nombre}`,
      detalle: `En los últimos 30 días gastaste ${pesos(mes)} ahí. Son entre ${d.fmtObjetivo(redondearLindo(imp.extraSemanal.min))} y ${d.fmtObjetivo(redondearLindo(imp.extraSemanal.max))} más por semana.`,
      ...imp,
      peso: (preferidas.has(normalizar(s.nombre)) ? 2 : 1) * imp.extraSemanal.max,
    });
  }

  // 2) Un gasto fijo chico (una suscripción, por ejemplo): el más chico de
  // varios, y sólo si es una parte menor del total. Así nunca aparece
  // "pausar el alquiler".
  const fijos = d.fijos
    .map((f) => ({ f, mes: (f.moneda === 'ARS' ? f.monto : 0) * MENSUAL[f.frecuencia] }))
    .filter((x) => x.mes > 0);
  const totalFijos = fijos.reduce((t, x) => t + x.mes, 0);
  if (fijos.length >= 2) {
    const chico = [...fijos].sort((a, b) => a.mes - b.mes)[0];
    if (chico.mes >= 2_000 && chico.mes <= totalFijos * 0.15) {
      const semanal = chico.mes / SEMANAS_POR_MES;
      const imp = impacto(semanal, semanal);
      if (imp) {
        candidatas.push({
          id: `fijo:${chico.f.id}`,
          titulo: `Pausar ${chico.f.descripcion}`,
          detalle: `Es un gasto fijo de ${pesos(chico.mes)} por mes.`,
          ...imp,
          peso: imp.extraSemanal.max,
        });
      }
    }
  }

  // 3) Lo que se separa: un poco más de lo que ya viene sumando, o, si todavía
  // no suma, una parte chica de lo que le entra.
  if (d.ritmo > 0) {
    const ritmoArs = d.ritmo / factor;
    const imp = impacto(ritmoArs * 0.2, ritmoArs * 0.4);
    if (imp) {
      const r = rangoLindo(d.ritmo * 0.85, d.ritmo * 1.15);
      candidatas.push({
        id: 'ritmo',
        titulo: 'Apartar entre 20% y 40% más por semana',
        detalle: `Venís apartando entre ${d.fmtObjetivo(r.min)} y ${d.fmtObjetivo(r.max)} por semana.`,
        ...imp,
        peso: imp.extraSemanal.max,
      });
    }
  } else {
    const entro = d.ingresos.filter((i) => i.ts >= desde && i.ts <= d.ahora).reduce((t, i) => t + i.montoArs, 0);
    if (entro > 0) {
      const semanal = entro / SEMANAS_POR_MES;
      const imp = impacto(semanal * 0.05, semanal * 0.1);
      if (imp) {
        candidatas.push({
          id: 'ingresos',
          titulo: 'Apartar entre 5% y 10% de tus ingresos',
          detalle: `En los últimos 30 días tus ingresos fueron ${pesos(entro)}. Entre un 5% y un 10% son entre ${d.fmtObjetivo(redondearLindo(imp.extraSemanal.min))} y ${d.fmtObjetivo(redondearLindo(imp.extraSemanal.max))} por semana.`,
          ...imp,
          // Sin aportes, esta es la puerta de entrada: va primero.
          peso: Number.MAX_SAFE_INTEGER,
        });
      }
    }
  }

  return candidatas
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 3)
    .map(({ peso: _peso, ...f }) => f);
}

/** "entre 2 y 3 semanas antes" / "entre 4 y 6 meses para lograrlo". */
export function textoImpacto(f: FormaDeLlegar): string {
  return f.modo === 'antes' ? `${textoTiempo(f.tiempo)} antes` : `${textoTiempo(f.tiempo)} para lograrlo`;
}

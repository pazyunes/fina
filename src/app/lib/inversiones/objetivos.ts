// Conectar lo que se invierte con para qué es la plata.
//
// Un objetivo ya sabe cuánto cuesta, cuánto lleva juntado y, a veces, para cuándo es. Con
// eso se puede decir algo mucho más útil que "invertí": cuánto separar por mes para llegar
// a tiempo, y cuánto menos hace falta separar si esa plata rinde mientras espera.
//
// Sólo objetivos en pesos: las inversiones que ofrece FINA se registran en pesos.

import type { Rango } from './motor.js';

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const MS_MES = 30.4375 * 24 * 60 * 60 * 1000;

/**
 * Cuántos meses faltan para el objetivo. El plazo se guarda como texto: una fecha ("15 de
 * diciembre de 2026") o una frase ("Lo antes posible"). null si no hay una fecha que alcance
 * para calcular.
 */
export function mesesHasta(horizonte: string | null | undefined, ahora: number = Date.now()): number | null {
  if (!horizonte) return null;
  if (/lo antes posible/i.test(horizonte)) return 3;
  const f = /(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/i.exec(horizonte.trim());
  if (!f) return null;
  const mes = MESES[f[2].toLowerCase()];
  if (mes === undefined) return null;
  const t = Date.UTC(Number(f[3]), mes, Number(f[1]), 12);
  const meses = (t - ahora) / MS_MES;
  return meses > 0 ? Math.max(1, Math.round(meses)) : null;
}

/**
 * Cuánto hay que separar por mes para juntar `faltante` en `meses`, si cada cuota entra a
 * principio de mes y rinde `tem` por mes hasta el final (el mismo criterio que el simulador).
 */
export function cuotaMensual(faltante: number, meses: number, tem: number): number {
  if (faltante <= 0 || meses <= 0) return 0;
  if (Math.abs(tem) < 1e-9) return faltante / meses;
  const crece = Math.pow(1 + tem, meses);
  return (faltante * tem) / ((1 + tem) * (crece - 1));
}

export type PlanDeObjetivo = {
  meses: number;
  faltante: number;
  /** Separando sin invertir, ni un peso rinde. */
  sinInvertir: number;
  /** Invirtiéndolo: un rango, porque el rendimiento no es fijo. null si no hay un rendimiento para estimar. */
  invirtiendo: Rango | null;
};

export function planDeObjetivo(faltante: number, meses: number, tem: Rango | null): PlanDeObjetivo {
  return {
    meses,
    faltante,
    sinInvertir: cuotaMensual(faltante, meses, 0),
    // Con más rendimiento hace falta menos: el mínimo de la cuota sale del rendimiento más alto.
    invirtiendo: tem ? { min: cuotaMensual(faltante, meses, tem.max), max: cuotaMensual(faltante, meses, tem.min) } : null,
  };
}

/** Lo que de un objetivo le sirve a las inversiones. */
export type ObjetivoParaInvertir = {
  id: string;
  nombre: string;
  montoTotal: number;
  juntado: number;
  faltante: number;
  /** null si no tiene una fecha que permita calcular. */
  meses: number | null;
};

export function paraInvertir(
  o: { id: string; nombre: string; moneda: string; estado: string; montoTotal: number | null },
  juntado: number,
  horizonte: string | null,
  ahora: number = Date.now(),
): ObjetivoParaInvertir | null {
  if (o.estado !== 'active' || o.moneda !== 'ARS' || !o.montoTotal || o.montoTotal <= 0) return null;
  const faltante = Math.max(0, o.montoTotal - juntado);
  if (faltante <= 0) return null;
  return { id: o.id, nombre: o.nombre, montoTotal: o.montoTotal, juntado, faltante, meses: mesesHasta(horizonte, ahora) };
}

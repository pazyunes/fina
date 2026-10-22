// ¿Cuánto poner? Sale de lo que a la persona realmente le queda cada mes, no de
// un número genérico.
//
// Principios (criterio del asesor):
//   · Se sugiere invertir TODO lo que sobró el mes pasado: no un porcentaje, no tres
//     meses de espera. Con el mes anterior alcanza para empezar. Si además hay algo
//     ahorrado, se puede sumar.
//   · Nada de "reserva" por las dudas: lo que sobra, se invierte. (Sólo si hay un gasto
//     cercano que no alcanza a cubrirse con lo que ingresa, aparece un fondo de garantía.)
//   · Nunca se bloquea: si hoy no sobra, se dice con claridad y se deja explorar
//     y simular.
//   · Un dato que no se puede saber (porque faltan ingresos cargados) se muestra
//     como "todavía no lo sabemos", no como cero.

import { fmtPesos } from './formato.js';
import type { Rango } from './motor.js';

type Movimiento = { montoArs: number; ts: number };

export type Sobrante = {
  /** Lo que sobró el último mes completo con ingresos (puede ser negativo). */
  ultimoMes: number;
  /** El mes en que menos sobró (puede ser negativo). */
  piso: number;
  mediana: number;
  /** Cuántos meses completos entraron en la cuenta. */
  meses: number;
  /** Promedio mensual de gastos. */
  gastoMensual: number;
  /** Promedio mensual de ingresos. */
  ingresoMensual: number;
};

const clave = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Qué le sobra por mes, mirando los últimos meses COMPLETOS (el mes en curso no
 * entra: está a medias). Un mes cuenta sólo si tiene ingresos cargados; si no,
 * "no sobró nada" sería una mentira: lo que pasa es que no sabemos.
 * Devuelve null si no hay al menos dos meses con datos.
 */
export function calcularSobrante(ingresos: Movimiento[], gastos: Movimiento[], ahora: number = Date.now()): Sobrante | null {
  const actual = clave(ahora);
  const porMes = new Map<string, { ing: number; gas: number }>();
  const sumar = (lista: Movimiento[], campo: 'ing' | 'gas') => {
    for (const m of lista) {
      const k = clave(m.ts);
      if (k >= actual) continue;
      const fila = porMes.get(k) ?? { ing: 0, gas: 0 };
      fila[campo] += m.montoArs;
      porMes.set(k, fila);
    }
  };
  sumar(ingresos, 'ing');
  sumar(gastos, 'gas');

  const validos = [...porMes.entries()]
    .filter(([, v]) => v.ing > 0)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 3);
  if (validos.length < 2) return null;

  const netos = validos.map(([, v]) => v.ing - v.gas).sort((a, b) => a - b);
  const mediana = netos.length % 2 === 1 ? netos[(netos.length - 1) / 2] : (netos[netos.length / 2 - 1] + netos[netos.length / 2]) / 2;
  const gastoMensual = validos.reduce((a, [, v]) => a + v.gas, 0) / validos.length;
  const ultimoMes = validos[0][1].ing - validos[0][1].gas;
  const ingresoMensual = validos.reduce((a, [, v]) => a + v.ing, 0) / validos.length;
  return { ultimoMes, piso: netos[0], mediana, meses: validos.length, gastoMensual, ingresoMensual };
}

// ── Gasto cercano que no se cubre ────────────────────────────────────────
/** Los días hacia adelante que cuentan como "cercano". */
export const DIAS_DE_GASTO_CERCANO = 30;

const MS_DIA = 24 * 60 * 60 * 1000;
const aISO = (ts: number): string => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * ¿Hay en los próximos 30 días gastos fijos (ya cargados, con su fecha) que sumados superan lo que
 * ingresa por mes? Sólo en ese caso conviene tener plata disponible (un fondo de garantía): en
 * cualquier otro, no se aparta nada "por las dudas". Sin ingresos conocidos no se puede decir: false.
 */
export function hayGastoCercanoSinCubrir(
  gastosFijos: { montoArs: number; proximoPago: string }[], ingresoMensual: number | null, ahora: number = Date.now(),
): boolean {
  if (!ingresoMensual || ingresoMensual <= 0) return false;
  const desde = aISO(ahora);
  const hasta = aISO(ahora + DIAS_DE_GASTO_CERCANO * MS_DIA);
  const suma = gastosFijos.filter((g) => g.proximoPago >= desde && g.proximoPago <= hasta).reduce((a, g) => a + g.montoArs, 0);
  return suma > ingresoMensual;
}

// ── La sugerencia ────────────────────────────────────────────────────────
export type SugerenciaMonto = {
  tipo: 'por-descubrir' | 'todavia-no' | 'regular';
  /** Lo que se sugiere invertir (todo lo que sobró el mes pasado). null si no hay base para sugerirlo. */
  monto: Rango | null;
  /** El monto con el que arranca, redondeado. null = que lo elija la persona. */
  primero: number | null;
  mensajes: string[];
};

export function sugerirMonto(sobrante: Sobrante | null): SugerenciaMonto {
  // Si no se sabe cuánto le sobra, no se dice nada: no hay nada que mostrar. La
  // pantalla simplemente no trae esta sección.
  if (!sobrante) return { tipo: 'por-descubrir', monto: null, primero: null, mensajes: [] };
  // Se redondea para abajo, a la centena: lo sugerido nunca es más de lo que sobró.
  const monto = Math.floor(sobrante.ultimoMes / 100) * 100;
  if (monto <= 0) return { tipo: 'todavia-no', monto: null, primero: null, mensajes: [] };

  return {
    tipo: 'regular',
    monto: { min: monto, max: monto },
    primero: monto,
    mensajes: [`El mes pasado te sobraron ${fmtPesos(monto)}. Una alternativa es invertirlo todo: no hace falta esperar tres meses ni invertir un pedacito. Si además tenés plata ahorrada, también la podés sumar.`],
  };
}

/** Qué horizonte tiene la plata según lo que contestó en el quiz. */
export function horizonteDesdeQuiz(porQue: string | null | undefined): number | null {
  if (!porQue) return null;
  if (porQue.startsWith('Sacarla pronto')) return 6;
  if (porQue.startsWith('Dejarla que rinda')) return 60;
  return null;
}

// ¿Cuánto poner? Sale de lo que a la persona realmente le queda cada mes, no de
// un número genérico.
//
// Principios:
//   · Se parte del PISO (el mes en que menos sobró), no del promedio: un monto
//     que sólo se puede sostener en los meses buenos termina en abandono.
//   · Nunca se bloquea: si hoy no sobra, se dice con claridad y se deja explorar
//     y simular. Sólo cambia la recomendación de cuánto.
//   · El primer monto es chico a propósito: la primera vez es para aprender cómo
//     se siente, no para ganar plata.
//   · Un dato que no se puede saber (porque faltan ingresos cargados) se muestra
//     como "todavía no lo sabemos", no como cero.

import { fmtPesos, redondearMonto } from './formato';
import type { Rango } from './motor';

type Movimiento = { montoArs: number; ts: number };

export type Sobrante = {
  /** El mes en que menos sobró (puede ser negativo). */
  piso: number;
  mediana: number;
  /** Cuántos meses completos entraron en la cuenta. */
  meses: number;
  /** Promedio mensual de gastos, para calcular el colchón. */
  gastoMensual: number;
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
  return { piso: netos[0], mediana, meses: validos.length, gastoMensual };
}

// ── El colchón ───────────────────────────────────────────────────────────
export type Colchon = { meta: number; actual: number; falta: number; cubierto: boolean };

/** Tres meses de gastos a mano es el colchón mínimo antes de pensar en inversiones más largas. */
export const MESES_DE_COLCHON = 3;

export function colchon(gastoMensual: number, reserva: number, enCaja: number): Colchon {
  const meta = gastoMensual * MESES_DE_COLCHON;
  const actual = Math.max(0, reserva) + Math.max(0, enCaja);
  return { meta, actual, falta: Math.max(0, meta - actual), cubierto: meta > 0 && actual >= meta * 0.9 };
}

// ── La sugerencia ────────────────────────────────────────────────────────
export type SugerenciaMonto = {
  tipo: 'por-descubrir' | 'todavia-no' | 'empezar-poco' | 'regular';
  /** Rango mensual sugerido. null si no hay base para sugerirlo. */
  monto: Rango | null;
  /** El monto de la primera vez, redondeado. null = que lo elija la persona. */
  primero: number | null;
  mensajes: string[];
};

export function sugerirMonto(sobrante: Sobrante | null): SugerenciaMonto {
  if (!sobrante) {
    return {
      tipo: 'por-descubrir',
      monto: null,
      primero: null,
      mensajes: [
        'Todavía no sabemos cuánto te sobra por mes. Con los ingresos y gastos de un mes más te lo afinamos.',
        'Mientras tanto, si querés probar, empezá con un monto chico que no necesites este mes.',
      ],
    };
  }
  if (sobrante.mediana <= 0) {
    return {
      tipo: 'todavia-no',
      monto: null,
      primero: null,
      mensajes: [
        'En los últimos meses no te sobró plata a fin de mes. Invertir es para lo que sobra, así que por ahora no te sugerimos un monto.',
        'Podés mirar y simular igual para entender cómo funciona. Y si querés, te ayudamos a ver en qué se va la plata para que aparezca algo para separar.',
      ],
    };
  }
  if (sobrante.piso <= 0) {
    const min = redondearMonto(sobrante.mediana * 0.05);
    const max = Math.max(min, redondearMonto(sobrante.mediana * 0.15));
    return {
      tipo: 'empezar-poco',
      monto: { min, max },
      primero: min,
      mensajes: [
        `En algunos meses no te sobró nada, y en el mejor te sobraron alrededor de ${fmtPesos(sobrante.mediana)}. Por eso arrancamos con poco.`,
        `Empezá con ${fmtPesos(min)}: alcanza para aprender cómo funciona sin que te falte plata un mes flojo.`,
      ],
    };
  }
  const min = redondearMonto(sobrante.piso * 0.15);
  const max = Math.max(min, redondearMonto(sobrante.piso * 0.4));
  return {
    tipo: 'regular',
    monto: { min, max },
    primero: min,
    mensajes: [
      `Mirando tus últimos ${sobrante.meses} meses, lo que menos te sobró fue ${fmtPesos(sobrante.piso)}. Partimos de ese mes, no del promedio, para que puedas sostenerlo siempre.`,
      `Te sugerimos entre ${fmtPesos(min)} y ${fmtPesos(max)} por mes. Para la primera vez, ${fmtPesos(min)}.`,
    ],
  };
}

/** Meses que tarda en juntar el colchón poniendo `porMes`. null si no se puede saber. */
export function mesesParaColchon(falta: number, porMes: number | null): number | null {
  if (falta <= 0) return 0;
  if (!porMes || porMes <= 0) return null;
  return Math.ceil(falta / porMes);
}

/** Qué horizonte tiene la plata según lo que contestó en el quiz. */
export function horizonteDesdeQuiz(porQue: string | null | undefined): number | null {
  if (!porQue) return null;
  if (porQue.startsWith('Sacarla pronto')) return 6;
  if (porQue.startsWith('Dejarla que rinda')) return 60;
  return null;
}

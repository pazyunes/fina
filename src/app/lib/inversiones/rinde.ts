// "¿Cuánto rinde?" dicho como lo diría una persona: el porcentaje, lo que
// significa por mes, y un mini ejemplo con plata (ponés tanto, el mes que viene
// tenés aproximadamente tanto). Sin comparaciones con la inflación a la vista:
// esa regla ya decidió qué se muestra; acá solo se explica lo que se obtiene.

import type { ProductoId } from './catalogo';
import { fmtPesos, pct } from './formato';
import type { Mercado } from './mercadoTipos';
import { temDeTna, type Evaluacion, type Veredicto } from './motor';

export type FichaRinde = {
  /** Lo grande: "19% anual", "Sigue a la inflación"… */
  titulo: string;
  /** Una línea de apoyo: "Cerca de 1,6% por mes". */
  detalle: string | null;
  ejemplo: string;
  /** Si hay un tope o una condición que cambia la cuenta, en una frase. */
  aclaracion: string | null;
  /** "Rinde más que la inflación" y similares, sin números. */
  chip: { texto: string; veredicto: Veredicto } | null;
  fecha: string | null;
};

/** El monto del ejemplo: redondo, para que la cuenta se siga de cabeza. */
export const BASE_EJEMPLO = 100_000;

const aCien = (n: number): number => Math.round(n / 100) * 100;

function chipDe(v: Veredicto): FichaRinde['chip'] {
  if (v === 'le-gana') return { texto: 'Rinde más que la inflación (lo que suben los precios)', veredicto: v };
  if (v === 'empata') return { texto: 'Rinde cerca de la inflación (lo que suben los precios)', veredicto: v };
  if (v === 'pierde') return { texto: 'Hoy rinde menos que la inflación (lo que suben los precios)', veredicto: v };
  return null;
}

export function describirRinde(producto: ProductoId, ev: Evaluacion | null, m: Mercado | null): FichaRinde | null {
  if (producto === 'dolar') {
    return {
      titulo: 'Sin rendimiento fijo',
      detalle: 'No paga intereses',
      ejemplo: `Si el dólar sube 10%, tus ${fmtPesos(BASE_EJEMPLO)} pasan a valer ${fmtPesos(BASE_EJEMPLO * 1.1)}. Si baja, valen menos.`,
      aclaracion: null,
      chip: null,
      fecha: ev?.fecha ?? null,
    };
  }
  if (producto === 'cedear') {
    const spy = m?.spy?.valor;
    return {
      titulo: 'Sin rendimiento fijo',
      detalle: 'Se mide a largo plazo',
      ejemplo: spy && spy.anualizado10a !== null
        ? `En los últimos 10 años, las 500 empresas más grandes de EE.UU. rindieron cerca de ${pct(spy.anualizado10a, 0)} por año en dólares${spy.peorAnio !== null && spy.peorAnio < 0 ? `, pero hubo períodos de 12 meses en que bajaron hasta ${pct(Math.abs(spy.peorAnio), 0)}` : ''}. Lo pasado no asegura lo que viene.`
        : 'En 10 años o más, el índice de las 500 empresas más grandes de EE.UU. rindió, en promedio, cerca de 10% por año en dólares, con años de pérdida en el medio. Lo pasado no asegura lo que viene.',
      aclaracion: null,
      chip: null,
      fecha: ev?.fecha ?? null,
    };
  }
  if (!ev || ev.veredicto === 'sin-dato') return null;

  if (producto === 'plazo_fijo_uva') {
    const uva = m?.inflacion.uva30d?.valor;
    if (uva === undefined) return null;
    const tem = uva / 100;
    return {
      titulo: 'Sigue a la inflación',
      detalle: `La UVA (un número que sube con la inflación) subió ${pct(uva, 1)} el último mes`,
      ejemplo: `Si ponés ${fmtPesos(BASE_EJEMPLO)}, el mes que viene tenés aproximadamente ${fmtPesos(aCien(BASE_EJEMPLO * (1 + tem)))}. Cambia con la inflación.`,
      aclaracion: null,
      chip: chipDe(ev.veredicto),
      fecha: ev.fecha,
    };
  }

  if (!ev.tna) return null;
  // En los fondos el rango es simétrico alrededor de lo medido: se muestra el centro.
  // En las demás se muestra el piso, que es lo que se cobra seguro.
  const tna = producto === 'fci' ? (ev.tna.min + ev.tna.max) / 2 : ev.tna.min;
  const tem = temDeTna(tna);
  const tope = ev.notas.find((n) => /hasta \$/i.test(n)) ?? null;
  // Si la cuenta paga más cumpliendo condiciones, se dice sin llenar la pantalla de números.
  const puedeLlegar = producto === 'cuenta_remunerada' && ev.tna.max - ev.tna.min >= 0.01
    ? `Puede llegar a ${pct(ev.tna.max * 100, 0)} anual si cumplís las condiciones de la cuenta.`
    : null;
  return {
    titulo: `${pct(tna * 100, 0)} anual`,
    detalle: `Cerca de ${pct(tem * 100, 1)} por mes`,
    ejemplo: `Si ponés ${fmtPesos(BASE_EJEMPLO)}, el mes que viene tenés aproximadamente ${fmtPesos(aCien(BASE_EJEMPLO * (1 + tem)))}.`,
    aclaracion: [puedeLlegar, tope].filter((x): x is string => x !== null).join(' ') || null,
    chip: chipDe(ev.veredicto),
    fecha: ev.fecha,
  };
}

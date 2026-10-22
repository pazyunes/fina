// La inflación de cada persona. La oficial es un promedio del país; a cada uno le
// pega distinto según en qué gasta y dónde vive. Si alguien gasta casi todo en
// alquiler y transporte, lo que le importa es cómo subieron esos rubros.
//
// Se calcula con las secciones en las que la persona ya registra sus gastos, los
// índices del INDEC de cada rubro y su zona (CABA/GBA o el resto del país). Es un
// ESTIMADO: se muestra como tal. Si faltan datos (pocos gastos, o casi todo
// queda sin rubro), no se calcula y no se dice nada.

import { rubroDeSeccion, regionDeZona, type RubroId } from './ipc';
import type { IpcRubros } from './mercadoTipos';

export type GastoParaInflacion = { montoArs: number; ts: number; seccion: string | null };

export type InflacionPersonal = {
  /** Fracción mensual: lo que, en promedio, subieron los precios de lo que esta persona consume. */
  mensual: number;
  /** Lo mismo, pero para el promedio del país o de su región (nivel general). */
  oficial: number;
  /** De qué parte de sus gastos se pudo saber el rubro (0 a 1). */
  cobertura: number;
  region: 'gba' | 'nacional';
  /** Último mes de los índices usados, 'YYYY-MM-DD'. */
  hasta: string;
  /** Cuánto pesa cada rubro en sus gastos, de mayor a menor. */
  pesos: { rubro: RubroId; peso: number }[];
};

const MS_DIA = 24 * 60 * 60 * 1000;

/** El promedio de las últimas variaciones mensuales de una serie de índices. */
function variacionMensual(serie: { fecha: string; valor: number }[], meses = 3): number | null {
  if (serie.length < 2) return null;
  const ult = serie.slice(-(meses + 1));
  const cambios: number[] = [];
  for (let i = 1; i < ult.length; i++) {
    if (ult[i - 1].valor > 0) cambios.push(ult[i].valor / ult[i - 1].valor - 1);
  }
  return cambios.length > 0 ? cambios.reduce((a, b) => a + b, 0) / cambios.length : null;
}

export function calcularInflacionPersonal(
  gastos: GastoParaInflacion[], ipc: IpcRubros | null, zona: string | null | undefined, ahora: number = Date.now(),
): InflacionPersonal | null {
  if (!ipc) return null;
  const region = regionDeZona(zona);
  const series = ipc[region];
  const general = series.general ? variacionMensual(series.general) : null;
  if (general === null) return null;

  const desde = ahora - 92 * MS_DIA;
  const recientes = gastos.filter((g) => g.ts >= desde && g.ts <= ahora && g.montoArs > 0);
  const meses = new Set(recientes.map((g) => new Date(g.ts).toISOString().slice(0, 7)));
  // Con pocos gastos o en un solo mes, un promedio de rubros no dice nada.
  if (recientes.length < 8 || meses.size < 2) return null;

  const total = recientes.reduce((a, g) => a + g.montoArs, 0);
  const porRubro = new Map<RubroId, number>();
  for (const g of recientes) {
    const r = rubroDeSeccion(g.seccion);
    porRubro.set(r, (porRubro.get(r) ?? 0) + g.montoArs);
  }
  const conocido = total - (porRubro.get('general') ?? 0);
  const cobertura = conocido / total;
  // Si casi todo cae en "general", la inflación personal sería la oficial con otro nombre.
  if (cobertura < 0.4) return null;

  let mensual = 0;
  const pesos: { rubro: RubroId; peso: number }[] = [];
  for (const [rubro, monto] of porRubro) {
    const peso = monto / total;
    const v = series[rubro] ? variacionMensual(series[rubro]) : null;
    // Un rubro sin serie vigente se mide como el nivel general: no se inventa.
    mensual += peso * (v ?? general);
    pesos.push({ rubro, peso });
  }
  pesos.sort((a, b) => b.peso - a.peso);
  const hasta = series.general[series.general.length - 1].fecha;
  return { mensual, oficial: general, cobertura, region, hasta, pesos };
}

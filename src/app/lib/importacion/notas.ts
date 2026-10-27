import { parsearFecha } from './fechas';
import { parsearMonto } from './montos';
import type { GastoImportado } from './tipos';

// Unas notas escritas a mano, un gasto por línea: "12/10 super 31.000",
// "- Almuerzo $8500", "3 de octubre, uber, 5200". Lo que no tiene un monto se
// salta y se cuenta como omitido.

const VIÑETA = /^\s*(?:[-*•·–]|\d+[.)])\s+/;
// Un monto: con signo de moneda opcional y con separadores de miles o decimales.
const MONTO = /(?:us\s?\$|u\$s|usd|\$)\s*\d[\d.,]*|\d[\d.,]*\s*(?:usd|dólares|dolares|pesos)\b|\d[\d.,]*\d|\d+/gi;
const FECHA = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{1,2}\.\d{1,2}\.\d{2,4}\b|\b\d{1,2}\s+de\s+[a-zñ]+(?:\s+de\s+\d{4})?\b|\b\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|set|oct|nov|dic)[a-z]*\.?(?:\s+\d{4})?\b/i;

export type GastosDeNotas = { gastos: GastoImportado[]; omitidos: number };

export function gastosDeNotas(notas: string, hoy: string): GastosDeNotas {
  const gastos: GastoImportado[] = [];
  let omitidos = 0;

  for (const cruda of notas.split(/\r?\n/)) {
    let linea = cruda.replace(VIÑETA, '').trim();
    if (!linea) continue;

    // La fecha, si hay, se saca primero para que no se confunda con un monto.
    let fecha: string | null = null;
    const f = FECHA.exec(linea);
    if (f) {
      const leida = parsearFecha(f[0], hoy);
      if (leida) { fecha = leida; linea = (linea.slice(0, f.index) + ' ' + linea.slice(f.index + f[0].length)).trim(); }
    }

    const candidatos = [...linea.matchAll(MONTO)].filter((m) => parsearMonto(m[0]) !== null);
    if (candidatos.length === 0) { omitidos++; continue; }
    // El que lleva signo de moneda; si ninguno, el último.
    const elegido = candidatos.find((m) => /[$]|us|usd|dólares|dolares|pesos/i.test(m[0])) ?? candidatos[candidatos.length - 1];
    const monto = parsearMonto(elegido[0]);
    if (!monto) { omitidos++; continue; }

    const descripcion = (linea.slice(0, elegido.index) + ' ' + linea.slice((elegido.index ?? 0) + elegido[0].length))
      .replace(/[$:;,\-–—|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    gastos.push({ fecha, descripcion: descripcion.slice(0, 80) || 'Gasto', monto: monto.monto, moneda: monto.moneda, categoria: null });
  }
  return { gastos, omitidos };
}

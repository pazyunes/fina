import { parsearFecha } from './fechas';
import { parsearMonto } from './montos';
import type { Celda, GastoImportado, Tabla } from './tipos';

// De una tabla (un Excel, un CSV) a gastos. Se busca la fila de títulos
// (Fecha, Descripción, Monto…); si no hay, se adivina qué es cada columna por lo
// que tiene adentro. Si no se puede saber cuál es la del monto, devuelve null y
// la app prueba con otra forma de leer.

type Columnas = { fecha: number; descripcion: number; monto: number; categoria: number; moneda: number };

const texto = (c: Celda): string => (c === null ? '' : String(c)).trim();
const SIN = -1;

const ES_FECHA = /^(fecha|date|día|dia)\b/;
const ES_MONTO = /(monto|importe|total|precio|valor|débito|debito|amount|pesos|costo)/;
const ES_DESCRIPCION = /(descripci|detalle|concepto|comercio|movimiento|nota|item|ítem|producto|referencia|gasto|qu[eé]\b)/;
const ES_CATEGORIA = /(categor|rubro|tipo)/;
const ES_MONEDA = /(moneda|divisa|currency)/;

function columnasPorTitulos(fila: Celda[]): Columnas | null {
  const cols: Columnas = { fecha: SIN, descripcion: SIN, monto: SIN, categoria: SIN, moneda: SIN };
  fila.forEach((c, i) => {
    const t = texto(c).toLowerCase();
    if (!t) return;
    if (cols.fecha === SIN && ES_FECHA.test(t)) cols.fecha = i;
    else if (cols.moneda === SIN && ES_MONEDA.test(t)) cols.moneda = i;
    else if (cols.categoria === SIN && ES_CATEGORIA.test(t)) cols.categoria = i;
    else if (cols.monto === SIN && ES_MONTO.test(t)) cols.monto = i;
    else if (cols.descripcion === SIN && ES_DESCRIPCION.test(t)) cols.descripcion = i;
  });
  // "Gasto" suelto puede ser el monto cuando ya hay una descripción.
  return cols.monto !== SIN ? cols : null;
}

/** Qué fracción de las celdas de una columna cumple algo. */
const fraccion = (celdas: Celda[], pred: (c: Celda) => boolean): number => {
  const llenas = celdas.filter((c) => texto(c) !== '');
  return llenas.length === 0 ? 0 : llenas.filter(pred).length / llenas.length;
};

function columnasPorContenido(filas: Celda[][], hoy: string): Columnas | null {
  const ancho = Math.max(...filas.map((f) => f.length));
  const columna = (i: number) => filas.map((f) => f[i] ?? null);
  const cols: Columnas = { fecha: SIN, descripcion: SIN, monto: SIN, categoria: SIN, moneda: SIN };

  for (let i = 0; i < ancho; i++) {
    if (fraccion(columna(i), (c) => typeof c === 'string' && parsearFecha(c, hoy) !== null) >= 0.6) { cols.fecha = i; break; }
  }
  // El monto: la columna de números que no es la de fechas; si hay varias, la más a la derecha.
  for (let i = ancho - 1; i >= 0; i--) {
    if (i === cols.fecha) continue;
    if (fraccion(columna(i), (c) => parsearMonto(c) !== null) >= 0.6) { cols.monto = i; break; }
  }
  if (cols.monto === SIN) return null;
  // La descripción: la columna con más texto que no sea fecha ni monto.
  let mejor = 0;
  for (let i = 0; i < ancho; i++) {
    if (i === cols.fecha || i === cols.monto) continue;
    const f = fraccion(columna(i), (c) => typeof c === 'string' && parsearMonto(c) === null && parsearFecha(c, hoy) === null);
    if (f > mejor) { mejor = f; cols.descripcion = i; }
  }
  return cols;
}

export type GastosDeTabla = { gastos: GastoImportado[]; omitidos: number };

export function gastosDeTabla(tabla: Tabla, hoy: string): GastosDeTabla | null {
  const filas = tabla.filter((f) => f.some((c) => texto(c) !== ''));
  if (filas.length === 0) return null;

  let cols: Columnas | null = null;
  let primera = 0;
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const c = columnasPorTitulos(filas[i]);
    if (c) { cols = c; primera = i + 1; break; }
  }
  if (!cols) cols = columnasPorContenido(filas, hoy);
  if (!cols) return null;

  const datos = filas.slice(primera);
  // Un extracto trae lo que salió con signo menos y lo que entró con más: si la mayoría son
  // negativos, las salidas son esas y se dejan afuera las entradas. Si la mayoría son positivos,
  // los negativos son devoluciones y se dejan afuera.
  const montos = datos.map((f) => parsearMonto(f[cols.monto] ?? null));
  const negativos = datos.filter((f, i) => montos[i] && esNegativo(f[cols.monto] ?? null)).length;
  const conMonto = montos.filter(Boolean).length;
  const hayNegativos = negativos > 0 && negativos * 2 >= conMonto;

  const gastos: GastoImportado[] = [];
  let omitidos = 0;
  datos.forEach((f, i) => {
    const m = montos[i];
    const desc = cols.descripcion === SIN ? '' : texto(f[cols.descripcion] ?? null);
    const esSalida = esNegativo(f[cols.monto] ?? null) === hayNegativos || (!hayNegativos && negativos === 0);
    if (!m || /^total\b/i.test(desc) || !esSalida) { omitidos++; return; }
    const crudaFecha = cols.fecha === SIN ? '' : texto(f[cols.fecha] ?? null);
    const monedaCol = cols.moneda === SIN ? '' : texto(f[cols.moneda] ?? null);
    gastos.push({
      fecha: crudaFecha ? parsearFecha(crudaFecha, hoy) : null,
      descripcion: desc.slice(0, 80) || 'Gasto',
      monto: m.monto,
      moneda: m.moneda === 'USD' || /us|d[oó]lar/i.test(monedaCol) ? 'USD' : 'ARS',
      categoria: cols.categoria === SIN ? null : texto(f[cols.categoria] ?? null).slice(0, 40) || null,
    });
  });
  return gastos.length === 0 ? null : { gastos, omitidos };
}

function esNegativo(c: Celda): boolean {
  if (typeof c === 'number') return c < 0;
  const t = texto(c);
  return t.startsWith('-') || /^\(.*\)$/.test(t) || t.endsWith('-');
}

import { leerCsv } from './csv';
import { gastosDeNotas } from './notas';
import { gastosDeTabla } from './tabla';
import { MAX_IMPORTADOS, type GastoImportado, type Tabla } from './tipos';
import { leerXlsx } from './xlsx';

// Qué se puede leer en el dispositivo y qué hay que mandar a leer.
//
// Un Excel, un CSV o unas notas bien ordenadas se leen acá, sin mandar nada a
// ningún lado. Una captura o un PDF (y los textos que no se entienden así) los
// lee el servidor.

export type ArchivoALeer = Pick<File, 'name' | 'type' | 'size'> & { text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> };

export type Entrada =
  /** `conTitulos`: la primera línea son los títulos de las columnas (se repite en cada tramo). */
  | { tipo: 'texto'; texto: string; conTitulos?: boolean }
  | { tipo: 'imagen' | 'pdf'; archivo: ArchivoALeer };

/** Lo que se pudo entender en el dispositivo, sin ayuda. Sirve de respaldo si la lectura con IA no anda. */
export type Respaldo = { gastos: GastoImportado[]; omitidos: number } | null;

export type LecturaLocal =
  /** Texto (de una planilla, un CSV o unas notas) para que lo lea la IA; con lo que ya se entendió acá de respaldo. */
  | { via: 'servidor'; entrada: Entrada; respaldo: Respaldo }
  | { via: 'error'; motivo: 'xls' | 'formato' | 'pesado' };

const MAX_BYTES_TABLA = 5_000_000;
/** Una planilla se manda en tramos: acá alcanza para ~500 filas. */
const MAX_CARACTERES_TABLA = 120_000;

const extension = (nombre: string) => nombre.toLowerCase().split('.').pop() ?? '';

/** Una tabla como texto, para que la lea el servidor cuando las columnas no se entienden. */
export function tablaATexto(tablas: Tabla[]): string {
  return tablas
    .map((t) => t.map((f) => f.map((c) => (c === null ? '' : String(c))).join(' | ')).join('\n'))
    .join('\n\n')
    .slice(0, MAX_CARACTERES_TABLA);
}

function juntar(lecturas: { gastos: GastoImportado[]; omitidos: number }[]): { gastos: GastoImportado[]; omitidos: number } {
  return {
    gastos: lecturas.flatMap((l) => l.gastos).slice(0, MAX_IMPORTADOS),
    omitidos: lecturas.reduce((s, l) => s + l.omitidos, 0),
  };
}

/** Lo que se pega o se escribe: notas con un gasto por línea. Lo lee la IA; lo que se entiende acá queda de respaldo. */
export function leerNotas(texto: string, hoy: string, conTitulos = false): LecturaLocal {
  const tabla = leerCsv(texto);
  // Un texto pegado desde una planilla (separado por tabs) se lee como tabla.
  const comoTabla = tabla.length > 1 && tabla.every((f) => f.length > 1) ? gastosDeTabla(tabla, hoy) : null;
  const notas = comoTabla ?? (() => { const n = gastosDeNotas(texto, hoy); return n.gastos.length > 0 ? n : null; })();
  return { via: 'servidor', entrada: { tipo: 'texto', texto: texto.slice(0, MAX_CARACTERES_TABLA), conTitulos }, respaldo: notas };
}

export async function leerArchivo(archivo: ArchivoALeer, hoy: string): Promise<LecturaLocal> {
  const ext = extension(archivo.name);

  if (archivo.type === 'application/pdf' || ext === 'pdf') return { via: 'servidor', entrada: { tipo: 'pdf', archivo }, respaldo: null };
  if (archivo.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
    return { via: 'servidor', entrada: { tipo: 'imagen', archivo }, respaldo: null };
  }
  if (ext === 'xls') return { via: 'error', motivo: 'xls' };

  if (ext === 'xlsx' || ext === 'xlsm') {
    if (archivo.size > MAX_BYTES_TABLA) return { via: 'error', motivo: 'pesado' };
    const tablas = await leerXlsx(await archivo.arrayBuffer());
    if (tablas.length === 0) return { via: 'error', motivo: 'formato' };
    const lecturas = tablas.map((t) => gastosDeTabla(t, hoy)).filter((l): l is NonNullable<typeof l> => l !== null);
    return { via: 'servidor', entrada: { tipo: 'texto', texto: tablaATexto(tablas), conTitulos: true }, respaldo: lecturas.length > 0 ? juntar(lecturas) : null };
  }

  if (['csv', 'tsv', 'txt', 'md', 'text'].includes(ext) || archivo.type.startsWith('text/')) {
    if (archivo.size > MAX_BYTES_TABLA) return { via: 'error', motivo: 'pesado' };
    return leerNotas(await archivo.text(), hoy, ext === 'csv' || ext === 'tsv');
  }
  return { via: 'error', motivo: 'formato' };
}

/** Cuántas líneas de una planilla o de unas notas se mandan por vez: cada llamada tiene que terminar rápido. */
const LINEAS_POR_TRAMO = 40;
const MAX_TRAMOS = 14;

/** Parte un texto en tramos de pocas líneas; en una planilla, cada tramo lleva los títulos. */
export function partirEnTramos(texto: string, conTitulos: boolean): string[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const titulos = conTitulos ? lineas.shift() : undefined;
  const tramos: string[] = [];
  for (let i = 0; i < lineas.length && tramos.length < MAX_TRAMOS; i += LINEAS_POR_TRAMO) {
    tramos.push([...(titulos ? [titulos] : []), ...lineas.slice(i, i + LINEAS_POR_TRAMO)].join('\n'));
  }
  return tramos.length > 0 ? tramos : [texto];
}

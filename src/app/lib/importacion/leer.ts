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
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imagen' | 'pdf'; archivo: ArchivoALeer };

export type LecturaLocal =
  | { via: 'local'; gastos: GastoImportado[]; omitidos: number }
  | { via: 'servidor'; entrada: Entrada }
  | { via: 'error'; motivo: 'xls' | 'formato' | 'pesado' };

const MAX_BYTES_TABLA = 5_000_000;
const MAX_CARACTERES_PARA_IA = 40_000;

const extension = (nombre: string) => nombre.toLowerCase().split('.').pop() ?? '';

/** Una tabla como texto, para que la lea el servidor cuando las columnas no se entienden. */
export function tablaATexto(tablas: Tabla[]): string {
  return tablas
    .map((t) => t.map((f) => f.map((c) => (c === null ? '' : String(c))).join(' | ')).join('\n'))
    .join('\n\n')
    .slice(0, MAX_CARACTERES_PARA_IA);
}

function juntar(lecturas: { gastos: GastoImportado[]; omitidos: number }[]): { gastos: GastoImportado[]; omitidos: number } {
  return {
    gastos: lecturas.flatMap((l) => l.gastos).slice(0, MAX_IMPORTADOS),
    omitidos: lecturas.reduce((s, l) => s + l.omitidos, 0),
  };
}

/** Lo que se pega o se escribe: notas con un gasto por línea. */
export function leerNotas(texto: string, hoy: string): LecturaLocal {
  const tabla = leerCsv(texto);
  // Un texto pegado desde una planilla (separado por tabs) se lee como tabla.
  const comoTabla = tabla.length > 1 && tabla.every((f) => f.length > 1) ? gastosDeTabla(tabla, hoy) : null;
  if (comoTabla) return { via: 'local', ...comoTabla };
  const notas = gastosDeNotas(texto, hoy);
  if (notas.gastos.length > 0) return { via: 'local', ...notas };
  return { via: 'servidor', entrada: { tipo: 'texto', texto: texto.slice(0, MAX_CARACTERES_PARA_IA) } };
}

export async function leerArchivo(archivo: ArchivoALeer, hoy: string): Promise<LecturaLocal> {
  const ext = extension(archivo.name);

  if (archivo.type === 'application/pdf' || ext === 'pdf') return { via: 'servidor', entrada: { tipo: 'pdf', archivo } };
  if (archivo.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
    return { via: 'servidor', entrada: { tipo: 'imagen', archivo } };
  }
  if (ext === 'xls') return { via: 'error', motivo: 'xls' };

  if (ext === 'xlsx' || ext === 'xlsm') {
    if (archivo.size > MAX_BYTES_TABLA) return { via: 'error', motivo: 'pesado' };
    const tablas = await leerXlsx(await archivo.arrayBuffer());
    const lecturas = tablas.map((t) => gastosDeTabla(t, hoy)).filter((l): l is NonNullable<typeof l> => l !== null);
    if (lecturas.length > 0) return { via: 'local', ...juntar(lecturas) };
    return tablas.length > 0 ? { via: 'servidor', entrada: { tipo: 'texto', texto: tablaATexto(tablas) } } : { via: 'error', motivo: 'formato' };
  }

  if (['csv', 'tsv', 'txt', 'md', 'text'].includes(ext) || archivo.type.startsWith('text/')) {
    if (archivo.size > MAX_BYTES_TABLA) return { via: 'error', motivo: 'pesado' };
    return leerNotas(await archivo.text(), hoy);
  }
  return { via: 'error', motivo: 'formato' };
}

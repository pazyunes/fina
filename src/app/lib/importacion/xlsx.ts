import { fechaDeSerialExcel } from './fechas';
import type { Celda, Tabla } from './tipos';

// Lee un .xlsx sin sumar ninguna librería: un .xlsx es un zip de archivos XML,
// y el navegador ya sabe descomprimir (DecompressionStream). Sólo se leen las
// hojas con sus textos, números y fechas. Un .xls viejo no es un zip y no se lee.

type EntradaZip = { nombre: string; metodo: number; tamanoComprimido: number; desplazamiento: number };

function leerZip(bytes: Uint8Array): EntradaZip[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('No es un archivo xlsx');
  const cantidad = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const entradas: EntradaZip[] = [];
  const decodificador = new TextDecoder();
  for (let i = 0; i < cantidad; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const tamanoComprimido = dv.getUint32(p + 20, true);
    const largoNombre = dv.getUint16(p + 28, true);
    const largoExtra = dv.getUint16(p + 30, true);
    const largoComentario = dv.getUint16(p + 32, true);
    const desplazamiento = dv.getUint32(p + 42, true);
    entradas.push({ nombre: decodificador.decode(bytes.subarray(p + 46, p + 46 + largoNombre)), metodo, tamanoComprimido, desplazamiento });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

async function descomprimir(bytes: Uint8Array, e: EntradaZip): Promise<string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const inicio = e.desplazamiento + 30 + dv.getUint16(e.desplazamiento + 26, true) + dv.getUint16(e.desplazamiento + 28, true);
  const datos = bytes.subarray(inicio, inicio + e.tamanoComprimido);
  if (e.metodo === 0) return new TextDecoder().decode(datos);
  if (e.metodo !== 8) throw new Error('Compresión no soportada');
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(flujo).arrayBuffer());
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const sinEntidades = (t: string) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
    return ENTIDADES[e] ?? `&${e};`;
  });

/** Todo el texto de los <t> de un trozo de XML (un <si> de textos compartidos o un <is>). */
const textosDe = (xml: string) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => sinEntidades(m[1])).join('');

function textosCompartidos(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textosDe(m[1]));
}

const FORMATOS_DE_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Qué estilos de celda (índice `s`) son fechas. */
function estilosDeFecha(xml: string | undefined): Set<number> {
  const salida = new Set<number>();
  if (!xml) return salida;
  const propios = new Set<number>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    // Un formato propio es de fecha si tiene d, m o y fuera de comillas y corchetes.
    const codigo = sinEntidades(m[2]).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    if (/[dmy]/i.test(codigo) && !/[0#]/.test(codigo)) propios.add(Number(m[1]));
  }
  const bloque = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!bloque) return salida;
  [...bloque[1].matchAll(/<xf\b[^>]*>/g)].forEach((m, i) => {
    const id = /numFmtId="(\d+)"/.exec(m[0]);
    if (id && (FORMATOS_DE_FECHA.has(Number(id[1])) || propios.has(Number(id[1])))) salida.add(i);
  });
  return salida;
}

const columnaDe = (ref: string): number => {
  let n = 0;
  for (const c of ref.replace(/\d+/g, '')) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

function leerHoja(xml: string, compartidos: string[], fechas: Set<number>): Tabla {
  const tabla: Tabla = [];
  for (const fila of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const celdas: Celda[] = [];
    for (const c of fila[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const tipo = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? 'n';
      const estilo = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
      const interior = c[2] ?? '';
      const v = /<v>([\s\S]*?)<\/v>/.exec(interior)?.[1];
      let valor: Celda = null;
      if (tipo === 's' && v !== undefined) valor = compartidos[Number(v)] ?? null;
      else if (tipo === 'inlineStr') valor = textosDe(interior);
      else if ((tipo === 'str' || tipo === 'e') && v !== undefined) valor = tipo === 'e' ? null : sinEntidades(v);
      else if (tipo === 'b') valor = null;
      else if (v !== undefined && v !== '') {
        const n = Number(v);
        valor = Number.isFinite(n) ? (fechas.has(estilo) ? fechaDeSerialExcel(n) : n) : null;
      }
      celdas[columnaDe(ref)] = valor;
    }
    // Los huecos de las celdas vacías quedan como null.
    tabla.push(Array.from(celdas, (c) => c ?? null));
  }
  return tabla;
}

/** Las hojas de un .xlsx, cada una como tabla. */
export async function leerXlsx(buffer: ArrayBuffer): Promise<Tabla[]> {
  const bytes = new Uint8Array(buffer);
  const entradas = leerZip(bytes);
  const texto = async (nombre: string) => {
    const e = entradas.find((x) => x.nombre === nombre);
    return e ? descomprimir(bytes, e) : undefined;
  };

  const compartidos = textosCompartidos(await texto('xl/sharedStrings.xml'));
  const fechas = estilosDeFecha(await texto('xl/styles.xml'));

  const hojas = entradas
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.nombre))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
  const salida: Tabla[] = [];
  for (const h of hojas) {
    const tabla = leerHoja(await descomprimir(bytes, h), compartidos, fechas);
    if (tabla.length > 0) salida.push(tabla);
  }
  return salida;
}

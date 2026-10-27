import { falla, ok, supabase, type Resultado } from './cliente';
import { diaArgentina } from './pasos';
import { achicar, pdfABase64 } from './capturas';
import { leerArchivo, leerNotas, partirEnTramos, type Entrada, type LecturaLocal } from '../../lib/importacion/leer';
import { MAX_IMPORTADOS, type LecturaImportacion } from '../../lib/importacion/tipos';

// Traer gastos de antes (un Excel, un CSV, unas notas, una captura o un PDF).
//
// Lo que se puede leer en el dispositivo (planillas, CSV, notas ordenadas) no
// sale de ahí. Lo demás (capturas, PDF y textos que no se entienden como lista)
// va a /api/importar-gastos, que lo lee y lo descarta: no se guarda nada.

export type { LecturaImportacion };

export type ErrorDeLectura = 'xls' | 'formato' | 'pesado' | 'falla';

/** Lo que vuelve de leer: la lectura, o por qué no se pudo (un .xls, un formato raro, un archivo muy pesado, o una falla). */
export type SalidaLectura = { tipo: 'ok'; lectura: LecturaImportacion } | { tipo: 'error'; motivo: ErrorDeLectura };

function esLectura(x: unknown): x is LecturaImportacion {
  return typeof x === 'object' && x !== null && typeof (x as Record<string, unknown>).estado === 'string';
}

async function leerEnElServidor(entrada: Entrada): Promise<Resultado<LecturaImportacion>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return falla<LecturaImportacion>('sin sesión', 'importarGastos');
    let cuerpo: Record<string, string>;
    if (entrada.tipo === 'texto') cuerpo = { tipo: 'texto', texto: entrada.texto };
    else if (entrada.tipo === 'pdf') {
      const { base64, tipoMime } = await pdfABase64(entrada.archivo as File);
      cuerpo = { tipo: 'pdf', datos: base64, tipoMime };
    } else {
      const { base64, tipoMime } = await achicar(entrada.archivo as File);
      cuerpo = { tipo: 'imagen', datos: base64, tipoMime };
    }
    const res = await fetch('/api/importar-gastos', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const respuesta: unknown = await res.json().catch(() => null);
    if (!res.ok || !esLectura(respuesta)) {
      const msg = (respuesta as { error?: string } | null)?.error ?? `respuesta ${res.status}`;
      return falla<LecturaImportacion>(msg, 'importarGastos');
    }
    return ok(respuesta);
  } catch (e) {
    return falla<LecturaImportacion>(e, 'importarGastos');
  }
}

/** Cuántas líneas de una planilla o de unas notas se mandan por vez: cada llamada tiene que terminar rápido. */
/** Cuántos tramos se leen a la vez. */
const A_LA_VEZ = 3;

async function leerTextoEnTramos(entrada: { texto: string; conTitulos?: boolean }): Promise<LecturaImportacion | 'falla'> {
  const tramos = partirEnTramos(entrada.texto, entrada.conTitulos === true);
  const lecturas: (LecturaImportacion | 'falla')[] = new Array(tramos.length).fill('falla');
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, tramos.length) }, async () => {
    while (siguiente < tramos.length) {
      const i = siguiente++;
      const r = await leerEnElServidor({ tipo: 'texto', texto: tramos[i] });
      lecturas[i] = r.error === null ? r.data : 'falla';
    }
  }));

  if (lecturas.some((l) => l !== 'falla' && l.estado === 'no_configurado')) return { estado: 'no_configurado' };
  const gastos = lecturas.flatMap((l) => (l !== 'falla' && l.estado === 'ok' ? l.gastos : []));
  if (gastos.length > 0) {
    // Los tramos que no se pudieron leer se cuentan como omitidos, no como si no existieran.
    const omitidos = lecturas.reduce((s, l, i) => s + (l === 'falla' ? tramos[i].split('\n').length : l.estado === 'ok' ? l.omitidos : 0), 0);
    return { estado: 'ok', gastos: gastos.slice(0, MAX_IMPORTADOS), omitidos };
  }
  return lecturas.every((l) => l !== 'falla' && l.estado === 'vacio') ? { estado: 'vacio' } : 'falla';
}

async function resolver(local: LecturaLocal): Promise<SalidaLectura> {
  if (local.via === 'error') return { tipo: 'error', motivo: local.motivo };
  const { entrada, respaldo } = local;
  const r: LecturaImportacion | 'falla' = entrada.tipo === 'texto'
    ? await leerTextoEnTramos(entrada)
    : await leerEnElServidor(entrada).then((x) => (x.error === null ? x.data : 'falla'));
  if (r !== 'falla' && r.estado === 'ok') return { tipo: 'ok', lectura: r };
  // Si la IA no está o no pudo, lo que se entendió en el dispositivo sirve igual.
  if (respaldo && respaldo.gastos.length > 0) return { tipo: 'ok', lectura: { estado: 'ok', gastos: respaldo.gastos, omitidos: respaldo.omitidos } };
  return r === 'falla' ? { tipo: 'error', motivo: 'falla' } : { tipo: 'ok', lectura: r };
}

/** Lee un archivo con gastos. */
export async function leerGastosDeArchivo(archivo: File): Promise<SalidaLectura> {
  try {
    return await resolver(await leerArchivo(archivo, diaArgentina()));
  } catch (e) {
    falla<null>(e, 'importarGastos');
    return { tipo: 'error', motivo: 'falla' };
  }
}

/** Lee unas notas pegadas, un gasto por línea. */
export async function leerGastosDeNotas(texto: string): Promise<SalidaLectura> {
  try {
    return await resolver(leerNotas(texto, diaArgentina()));
  } catch (e) {
    falla<null>(e, 'importarGastos');
    return { tipo: 'error', motivo: 'falla' };
  }
}

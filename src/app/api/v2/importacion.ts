import { falla, ok, supabase, type Resultado } from './cliente';
import { diaArgentina } from './pasos';
import { achicar, pdfABase64 } from './capturas';
import { leerArchivo, leerNotas, type Entrada, type LecturaLocal } from '../../lib/importacion/leer';
import type { LecturaImportacion } from '../../lib/importacion/tipos';

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

async function resolver(local: LecturaLocal): Promise<SalidaLectura> {
  if (local.via === 'error') return { tipo: 'error', motivo: local.motivo };
  if (local.via === 'local') {
    return { tipo: 'ok', lectura: local.gastos.length > 0 ? { estado: 'ok', gastos: local.gastos, omitidos: local.omitidos } : { estado: 'vacio' } };
  }
  const r = await leerEnElServidor(local.entrada);
  return r.error === null ? { tipo: 'ok', lectura: r.data } : { tipo: 'error', motivo: 'falla' };
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

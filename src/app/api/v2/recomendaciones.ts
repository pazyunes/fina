import { falla, ok, supabase, type Resultado } from './cliente';
import { avisarConfirmacion } from './almacen';

// Las recomendaciones del día, la semana y el mes.
//
// Las arma la función del servidor /api/recomendaciones con un modelo de IA. Acá
// sólo se pide y se marca si sirvió. El pedido lleva el token de la sesión: la
// función lee y escribe COMO la persona, con las mismas policies de siempre.
//
// La primera vez de cada período puede tardar (el modelo tiene que pensar),
// después sale guardada. Por eso se recuerda la última respuesta, para mostrarla
// al volver a Home mientras se revisa si hay algo nuevo, y se evita pedir dos
// veces a la vez.

export type PeriodoRecomendacion = 'dia' | 'semana' | 'mes';
export const PERIODOS_RECOMENDACION: PeriodoRecomendacion[] = ['dia', 'semana', 'mes'];

export type DestinoRecomendacion = 'gastos' | 'objetivos' | 'inversiones' | 'perfil' | 'grupos' | 'whatsapp';

export type Recomendacion = {
  titulo: string;
  texto: string;
  dato: { valor: string; referencia: string };
  confianza: 'confirmado' | 'estimado';
  accion: { etiqueta: string; destino: DestinoRecomendacion } | null;
};

export type TarjetaRecomendacion =
  | { estado: 'lista'; id: string; contenido: Recomendacion; util: boolean | null }
  | { estado: 'faltan_datos'; mensaje: string }
  | { estado: 'sin_recomendacion' }
  | { estado: 'no_configurado' }
  | { estado: 'error'; mensaje: string };

export type Recomendaciones = Record<PeriodoRecomendacion, TarjetaRecomendacion>;

const ESTADOS = new Set(['lista', 'faltan_datos', 'sin_recomendacion', 'no_configurado', 'error']);

function esRecomendaciones(x: unknown): x is Recomendaciones {
  if (!x || typeof x !== 'object') return false;
  return PERIODOS_RECOMENDACION.every((p) => {
    const t = (x as Record<string, unknown>)[p];
    return !!t && typeof t === 'object' && ESTADOS.has(String((t as { estado?: unknown }).estado));
  });
}

let ultima: Recomendaciones | null = null;
let enCurso: Promise<Resultado<Recomendaciones>> | null = null;

/** La última respuesta que llegó en esta pestaña, para pintar sin esperar. */
export function recomendacionesRecordadas(): Recomendaciones | null {
  return ultima;
}

export function leerRecomendaciones(): Promise<Resultado<Recomendaciones>> {
  if (enCurso) return enCurso;
  enCurso = pedir().finally(() => { enCurso = null; });
  return enCurso;
}

async function pedir(): Promise<Resultado<Recomendaciones>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return falla<Recomendaciones>('sin sesión', 'leerRecomendaciones');
    const res = await fetch('/api/recomendaciones', {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
    const cuerpo: unknown = await res.json().catch(() => null);
    if (!res.ok || !esRecomendaciones(cuerpo)) {
      const msg = (cuerpo as { error?: string } | null)?.error ?? `respuesta ${res.status}`;
      return falla<Recomendaciones>(msg, 'leerRecomendaciones');
    }
    ultima = cuerpo;
    return ok(cuerpo);
  } catch (e) {
    return falla<Recomendaciones>(e, 'leerRecomendaciones');
  }
}

/**
 * Lo que la persona marcó: true = me sirvió, false = no, null = sacar la marca.
 * Esto es lo que usa el modelo la próxima vez para no insistir con lo que no le
 * sirve. Desde el navegador sólo se puede cambiar esta columna (0029).
 */
export async function marcarUtil(id: string, util: boolean | null): Promise<Resultado<null>> {
  try {
    const { error } = await supabase.from('recommendations').update({ util }).eq('id', id);
    if (error) return falla<null>(error.message, 'marcarUtil');
    if (ultima) {
      const nueva: Recomendaciones = { ...ultima };
      for (const p of PERIODOS_RECOMENDACION) {
        const t = nueva[p];
        if (t.estado === 'lista' && t.id === id) nueva[p] = { ...t, util };
      }
      ultima = nueva;
    }
    if (util !== null) avisarConfirmacion('Gracias. Lo tenemos en cuenta para las próximas.');
    return ok(null);
  } catch (e) {
    return falla<null>(e, 'marcarUtil');
  }
}

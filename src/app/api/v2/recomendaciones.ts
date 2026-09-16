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

/**
 * `pasosPosibles`: los pasos que la persona puede cumplir mañana (ver
 * `pasosPosiblesManana`). Con eso, junto con la recomendación del día, la IA
 * elige el paso de mañana.
 */
export function leerRecomendaciones(pasosPosibles: string[] = []): Promise<Resultado<Recomendaciones>> {
  if (enCurso) return enCurso;
  enCurso = pedir(pasosPosibles).finally(() => { enCurso = null; });
  return enCurso;
}

async function pedir(pasosPosibles: string[]): Promise<Resultado<Recomendaciones>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return falla<Recomendaciones>('sin sesión', 'leerRecomendaciones');
    const query = pasosPosibles.length ? `?pasos=${encodeURIComponent(pasosPosibles.join(','))}` : '';
    const res = await fetch(`/api/recomendaciones${query}`, {
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
    if (util !== null) avisarConfirmacion('Respuesta guardada con éxito.');
    return ok(null);
  } catch (e) {
    return falla<null>(e, 'marcarUtil');
  }
}

// ── El paso del día elegido por la IA ────────────────────────────────────
// Se elige el día anterior (junto con la recomendación del día) y queda
// guardado para el día en que toca. Así se muestra al instante al abrir la app,
// sin esperar al modelo.

export type PasoElegido = { clave: string; mensaje: string };

/** El paso que la IA eligió para `dia`, o null si no eligió ninguno. */
export async function leerPasoElegido(dia: string): Promise<PasoElegido | null> {
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select('contenido')
      .eq('periodo', 'paso')
      .eq('clave', dia)
      .maybeSingle();
    // Sin la migración 0029 la tabla no existe: no hay paso elegido y decide
    // la regla, que es lo que pasaba antes.
    if (error || !data) return null;
    const c = (data as { contenido: { clave?: unknown; mensaje?: unknown } | null }).contenido;
    if (!c || typeof c.clave !== 'string' || typeof c.mensaje !== 'string') return null;
    return { clave: c.clave, mensaje: c.mensaje };
  } catch {
    return null;
  }
}

// ── Los planes de los objetivos ──────────────────────────────────────────

export type PlanObjetivo = {
  /** id de la fila de la recomendación, para marcar si sirvió. */
  id: string;
  objetivoId: string;
  titulo: string;
  texto: string;
  /** Rango en la moneda del objetivo. null = sin monto o sin datos para estimar. */
  separarPorSemana: { min: number; max: number } | null;
  util: boolean | null;
};

/** El plan más reciente de cada objetivo, por id de objetivo. */
export async function leerPlanesDeObjetivos(): Promise<Map<string, PlanObjetivo>> {
  const planes = new Map<string, PlanObjetivo>();
  try {
    const { data, error } = await supabase
      .from('recommendations')
      .select('id, clave, contenido, util, created_at')
      .eq('periodo', 'objetivo')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return planes;
    for (const fila of data as { id: string; clave: string; contenido: Record<string, unknown> | null; util: boolean | null }[]) {
      const c = fila.contenido;
      const objetivoId = fila.clave.split(':')[1];
      if (!c || !objetivoId || planes.has(objetivoId)) continue;
      if (typeof c.titulo !== 'string' || typeof c.texto !== 'string') continue;
      const rango = c.separarPorSemana as { min?: unknown; max?: unknown } | null;
      planes.set(objetivoId, {
        id: fila.id,
        objetivoId,
        titulo: c.titulo,
        texto: c.texto,
        separarPorSemana: rango && typeof rango.min === 'number' && typeof rango.max === 'number' && rango.max > 0
          ? { min: Math.max(0, Math.min(rango.min, rango.max)), max: Math.max(rango.min, rango.max) }
          : null,
        util: fila.util,
      });
    }
  } catch {
    // Sin planes, Objetivos muestra lo de siempre.
  }
  return planes;
}

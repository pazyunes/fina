import { supabase } from '../../lib/supabase';

// Único lugar donde el flujo v2 habla con Supabase. Los componentes no importan
// `supabase` nunca (regla 6 de CLAUDE.md: ningún componente hace fetch directo).

export { supabase };

/** El id de la usuaria logueada, o null. */
export async function idUsuaria(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// Los errores no se tragan: se devuelven para que la UI pueda decir que algo no
// se guardó. Un guardado que falla en silencio es peor que uno que falla, porque
// la persona sigue confiando en un número que no existe.
export type Resultado<T> = { data: T; error: null } | { data: null; error: string };

export function ok<T>(data: T): Resultado<T> {
  return { data, error: null };
}

export function falla<T>(e: unknown, contexto: string): Resultado<T> {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
  // eslint-disable-next-line no-console
  console.error(`[api/v2] ${contexto}:`, msg);
  return { data: null, error: msg };
}

/** Envuelve una query de Supabase y normaliza el error. */
export async function correr<T>(
  contexto: string,
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<Resultado<T>> {
  try {
    const { data, error } = await fn();
    if (error) return falla<T>(error.message, contexto);
    return ok(data as T);
  } catch (e) {
    return falla<T>(e, contexto);
  }
}

/** Slug estable para casar nombres de sección con lo que ya existía en v2. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'otro'
  );
}

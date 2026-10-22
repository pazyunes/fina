import type { ProductoId } from '../../lib/inversiones/catalogo';

// Noticias del día que pueden mover cada tipo de inversión, explicadas.
// Las arma /api/noticias (ver ese archivo para las reglas). Son públicas: no hace
// falta sesión. Se cachean 30 minutos en memoria, lo mismo que el servidor.

export type NoticiaInversion = {
  titular: string;
  fuente: string;
  /** ISO */
  fecha: string;
  enlace: string;
  /** La explicación en criollo. null si sólo tenemos el titular. */
  queSignifica: string | null;
};

const TREINTA_MIN = 30 * 60 * 1000;
const cache = new Map<string, { cuando: number; noticias: NoticiaInversion[] }>();

function esNoticia(x: unknown): x is NoticiaInversion {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.titular === 'string' && typeof o.fuente === 'string' && typeof o.enlace === 'string' && typeof o.fecha === 'string'
    && (o.queSignifica === null || typeof o.queSignifica === 'string');
}

/** Las noticias de hoy para este tipo de inversión. Lista vacía si no hay o no se pudieron traer. */
export async function traerNoticias(tipo: ProductoId): Promise<NoticiaInversion[]> {
  const guardado = cache.get(tipo);
  if (guardado && Date.now() - guardado.cuando < TREINTA_MIN) return guardado.noticias;
  try {
    const res = await fetch(`/api/noticias?tipo=${encodeURIComponent(tipo)}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return guardado?.noticias ?? [];
    const json: unknown = await res.json();
    const lista = typeof json === 'object' && json !== null ? (json as { noticias?: unknown }).noticias : null;
    if (!Array.isArray(lista)) return guardado?.noticias ?? [];
    const noticias = lista.filter(esNoticia);
    cache.set(tipo, { cuando: Date.now(), noticias });
    return noticias;
  } catch {
    return guardado?.noticias ?? [];
  }
}

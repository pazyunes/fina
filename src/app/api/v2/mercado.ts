import type { Mercado } from '../../lib/inversiones/mercadoTipos';

// Datos de mercado para las recomendaciones de inversión.
//
// Los arma y cachea el servidor (api/mercado.ts); acá sólo se piden. Los
// componentes no llaman a esto directo: usan `useMercado` (lib/inversiones).
// Se cachea en memoria 5 minutos, lo mismo que el servidor, para no pedirlo en
// cada pantalla que lo necesite.

export type EstadoMercado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; mercado: Mercado }
  | { tipo: 'error' };

const CINCO_MIN = 5 * 60 * 1000;
let cache: { cuando: number; mercado: Mercado } | null = null;
let pendiente: Promise<Mercado | null> | null = null;

function esMercado(x: unknown): x is Mercado {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.generadoEn === 'string' && typeof o.inflacion === 'object' && typeof o.dolar === 'object';
}

/** El último paquete que se vio (aunque esté vencido), sin pedir nada. */
export function mercadoEnMemoria(): Mercado | null {
  return cache?.mercado ?? null;
}

/**
 * Trae los datos de mercado. Si no se pudo, devuelve null (y la pantalla dice que hubo un error).
 * Nunca inventa un valor ni rellena con uno viejo.
 */
export function traerMercado(forzar = false): Promise<Mercado | null> {
  if (!forzar && cache && Date.now() - cache.cuando < CINCO_MIN) return Promise.resolve(cache.mercado);
  if (pendiente) return pendiente;

  pendiente = (async () => {
    try {
      // Al reintentar se pide un paquete nuevo en lugar del que quedó guardado.
      const res = await fetch(forzar ? `/api/mercado?fresco=${Date.now()}` : '/api/mercado', { headers: { accept: 'application/json' } });
      // Si no se pudo traer, es un error: no se rellena con lo que había (la pantalla dice "hubo un error").
      if (!res.ok) return null;
      const json: unknown = await res.json();
      if (!esMercado(json)) return null;
      cache = { cuando: Date.now(), mercado: json };
      return json;
    } catch {
      return null;
    } finally {
      pendiente = null;
    }
  })();
  return pendiente;
}

// La cotización del dólar, con su id.
//
// Es el patrón de cotización congelada: un gasto en dólares guarda los dos
// montos (el que se tipeó y su equivalente en pesos) MÁS el id de la
// cotización que los une. Así, cuando el dólar cambie, el gasto de hace tres
// meses sigue diciendo lo que costó ese día en vez de recalcularse solo.
//
// El endpoint /api/dolar (función serverless) ya hace el trabajo: devuelve la
// última cotización guardada si tiene menos de una hora, y si no la trae de
// dolarapi y la inserta en `exchange_rates`. Acá sólo se cachea en memoria
// para no pegarle en cada tecla.

export type Cotizacion = {
  /** Pesos por dólar. */
  valor: number;
  /** FK a exchange_rates. null si no se pudo guardar del lado servidor. */
  id: string | null;
  /** true si es vieja: la última que hay, pero no se pudo refrescar. */
  vieja: boolean;
};

let cache: { c: Cotizacion; cuando: number } | null = null;
const UNA_HORA = 60 * 60 * 1000;

export async function cotizacionDolar(): Promise<Cotizacion | null> {
  if (cache && Date.now() - cache.cuando < UNA_HORA) return cache.c;
  try {
    const res = await fetch('/api/dolar', { headers: { accept: 'application/json' } });
    if (!res.ok) return cache?.c ?? null;
    const j = (await res.json()) as { rate?: number; id?: string | null; stale?: boolean };
    const valor = Number(j.rate);
    if (!valor || Number.isNaN(valor)) return cache?.c ?? null;
    const c: Cotizacion = { valor, id: j.id ?? null, vieja: !!j.stale };
    cache = { c, cuando: Date.now() };
    return c;
  } catch {
    // Sin red: se devuelve la última que se vio, si hay. Nunca se inventa un
    // valor: sin cotización, un monto en dólares no se puede pasar a pesos.
    return cache?.c ?? null;
  }
}

/** Deja la cotización lista para que una conversión no tenga que esperar. */
export function precargarCotizacion() {
  void cotizacionDolar();
}

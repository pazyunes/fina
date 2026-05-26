import { ExchangeRate } from '../types';

// Llama a la Vercel Function /api/dolar (USD blue, venta, con historial en
// Supabase). Devuelve null si falla o si corre en un entorno sin la función
// (p. ej. `vite` local sin `vercel dev`), para que la UI degrade a solo-ARS.
export async function fetchExchangeRate(): Promise<ExchangeRate | null> {
  try {
    const res = await fetch('/api/dolar', { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (typeof json?.rate !== 'number') return null;
    return {
      id: json.id ?? null,
      currency: json.currency ?? 'USD_BLUE',
      rate: json.rate,
      fetchedAt: json.fetchedAt ?? new Date().toISOString(),
      stale: Boolean(json.stale),
    };
  } catch {
    return null;
  }
}

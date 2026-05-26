// Vercel Serverless Function (este proyecto es un SPA de Vite, no Next.js, así
// que NO se usa la firma `route.ts` del App Router). Vercel toma cualquier
// archivo dentro de /api como función. Reusa las env vars ya configuradas
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) del lado servidor.
import { createClient } from '@supabase/supabase-js';

const CURRENCY = 'USD_BLUE';
const ONE_HOUR_MS = 60 * 60 * 1000;
const DOLARAPI_URL = 'https://dolarapi.com/v1/dolares/blue';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase no configurado en el servidor' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // 1) Última cotización guardada
  const { data: latest } = await supabase
    .from('exchange_rates')
    .select('id, rate, fetched_at')
    .eq('currency', CURRENCY)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isFresh = latest && Date.now() - new Date(latest.fetched_at).getTime() < ONE_HOUR_MS;

  if (isFresh) {
    res.status(200).json({
      currency: CURRENCY,
      rate: Number(latest.rate),
      fetchedAt: latest.fetched_at,
      id: latest.id,
      stale: false,
      cached: true,
    });
    return;
  }

  // 2) Vencida o inexistente → pegar a dolarapi
  try {
    const apiRes = await fetch(DOLARAPI_URL, { headers: { accept: 'application/json' } });
    if (!apiRes.ok) throw new Error(`dolarapi respondió ${apiRes.status}`);
    const json = await apiRes.json();
    const venta = Number(json?.venta);
    if (!venta || Number.isNaN(venta)) throw new Error('dolarapi sin valor de venta');

    const { data: inserted, error: insertError } = await supabase
      .from('exchange_rates')
      .insert({ currency: CURRENCY, rate: venta, source: 'dolarapi' })
      .select('id, rate, fetched_at')
      .single();

    if (insertError || !inserted) {
      // No se pudo guardar pero tenemos el valor fresco: devolverlo igual.
      res.status(200).json({
        currency: CURRENCY,
        rate: venta,
        fetchedAt: new Date().toISOString(),
        id: null,
        stale: false,
        cached: false,
      });
      return;
    }

    res.status(200).json({
      currency: CURRENCY,
      rate: Number(inserted.rate),
      fetchedAt: inserted.fetched_at,
      id: inserted.id,
      stale: false,
      cached: false,
    });
  } catch (err) {
    // 3) dolarapi falló → devolver la última disponible aunque esté vencida
    if (latest) {
      res.status(200).json({
        currency: CURRENCY,
        rate: Number(latest.rate),
        fetchedAt: latest.fetched_at,
        id: latest.id,
        stale: true,
        cached: true,
      });
      return;
    }
    res.status(503).json({ error: 'No hay cotización disponible', stale: true });
  }
}

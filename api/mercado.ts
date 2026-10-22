// Vercel Serverless Function: los datos de mercado que usan las recomendaciones
// de inversión (inflación, tasas, fondos, dólar, letras...).
//
// Son datos PÚBLICOS: no hace falta sesión. Se arman en el servidor porque el
// navegador no tiene por qué pegarle a siete APIs distintas (ni exponerse a que
// una cambie de formato), y porque acá se puede guardar lo que baja.
//
// Frescura: cada respuesta se cachea 5 minutos en memoria y en el CDN de
// Vercel. Dentro de esa ventana todas las personas ven el mismo paquete; fuera
// de ella el próximo pedido lo regenera. Cada dato dentro del paquete trae SU
// fecha, así que "actualizado hace 5 minutos" no se confunde con "el dato es de
// hoy": la inflación, por ejemplo, es la del último mes que publicó el INDEC.
//
// Respaldo: si una fuente falla, se conserva el dato anterior con su fecha
// original (la regla de vigencia lo marca vencido si ya no sirve). Si falla
// casi todo, se devuelve el último paquete guardado, marcado `desactualizado`.
//
// Persistencia (opcional): si existe SUPABASE_SERVICE_ROLE_KEY, cada día se
// guarda una foto en `market_snapshots` (migración 0039) para tener historia y
// respaldo entre reinicios. Sin esa variable la función anda igual, sólo que el
// respaldo vive en la memoria de la instancia. Se usa service_role y no la anon
// key a propósito: si cualquiera pudiera escribir esa tabla, cualquiera podría
// envenenar el respaldo con números falsos.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Mercado } from '../src/app/lib/inversiones/mercadoTipos.js';
import { completarConHistoria, construirMercado, hoyAR, paqueteUtil, rellenarConAnterior } from './_mercado/fuentes.js';

type Req = { method?: string };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

const CINCO_MIN = 5 * 60 * 1000;

let memoria: { cuando: number; datos: Mercado } | null = null;
let enCurso: Promise<Mercado> | null = null;

function clienteServicio(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false } });
}

async function leerUltimoGuardado(db: SupabaseClient | null): Promise<Mercado | null> {
  if (!db) return null;
  try {
    const { data } = await db.from('market_snapshots').select('data').order('day', { ascending: false }).limit(1).maybeSingle();
    return data ? (data.data as Mercado) : null;
  } catch {
    return null;
  }
}

/** Las fotos de los últimos ~40 días, para calcular el rendimiento de 7 y 30 días. */
async function leerFotos(db: SupabaseClient | null): Promise<Mercado[]> {
  if (!db) return [];
  try {
    const { data } = await db.from('market_snapshots').select('data').order('day', { ascending: false }).limit(40);
    return (data ?? []).map((f) => f.data as Mercado);
  } catch {
    return [];
  }
}

async function guardar(db: SupabaseClient | null, m: Mercado): Promise<void> {
  if (!db) return;
  try {
    await db.from('market_snapshots').upsert({ day: hoyAR(), data: m, fetched_at: m.generadoEn }, { onConflict: 'day' });
  } catch {
    /* guardar es un extra: si la tabla todavía no existe, la función sigue andando */
  }
}

async function regenerar(): Promise<Mercado> {
  const db = clienteServicio();
  const previo = memoria?.datos ?? (await leerUltimoGuardado(db));
  const fotos = await leerFotos(db);
  const nuevo = completarConHistoria(rellenarConAnterior(await construirMercado(), previo), fotos);

  if (!paqueteUtil(nuevo)) {
    // Casi nada llegó: mejor el último paquete bueno, dicho como desactualizado, que uno vacío.
    if (previo) return { ...previo, desactualizado: true, fallas: nuevo.fallas };
    return { ...nuevo, desactualizado: true };
  }
  await guardar(db, nuevo);
  return nuevo;
}

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  if (!memoria || Date.now() - memoria.cuando >= CINCO_MIN) {
    // Si varias personas piden a la vez, todas esperan la misma regeneración.
    enCurso ??= regenerar().finally(() => { enCurso = null; });
    try {
      memoria = { cuando: Date.now(), datos: await enCurso };
    } catch (e) {
      if (!memoria) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(503).json({ error: 'No hay datos de mercado disponibles', detalle: e instanceof Error ? e.message : String(e) });
        return;
      }
      // Hay uno viejo en memoria: se sirve, marcado.
      memoria = { cuando: memoria.cuando, datos: { ...memoria.datos, desactualizado: true } };
    }
  }

  // Un paquete desactualizado no se deja en el CDN: que el próximo pedido reintente.
  res.setHeader(
    'Cache-Control',
    memoria.datos.desactualizado ? 'no-store' : 'public, s-maxage=300, stale-while-revalidate=900',
  );
  res.status(200).json(memoria.datos);
}

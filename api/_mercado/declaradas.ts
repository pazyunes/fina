// Lee de la base lo que las personas declararon en los últimos 7 días y lo agrega.
// Usa service_role: tiene que ver a todas las personas. Sólo devuelve medianas por lugar,
// nunca quién declaró qué.

import type { SupabaseClient } from '@supabase/supabase-js';
import { agregarDeclaradas, DIAS_DE_VIGENCIA, type FilaDeclarada } from '../../src/app/lib/inversiones/declaradas.js';
import type { TasaDeclarada } from '../../src/app/lib/inversiones/mercadoTipos.js';

export async function leerDeclaradas(db: SupabaseClient | null, hoy: string): Promise<Record<string, TasaDeclarada>> {
  if (!db) return {};
  const desde = new Date(new Date(`${hoy}T12:00:00Z`).getTime() - DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const { data, error } = await db.from('declared_rates').select('user_id, kind, provider, fund, tna, declared_on').gte('declared_on', desde);
    if (error) return {}; // sin la migración 0041 no hay nada declarado: no es un error
    return agregarDeclaradas(((data ?? []) as FilaDeclarada[]).map((f) => ({ ...f, tna: Number(f.tna) })));
  } catch {
    return {};
  }
}

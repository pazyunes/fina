// Qué pasa cuando un chequeo de datos no cierra.
//
// Dónde le llega el aviso a quien mantiene FINA:
//   1. Una notificación en su celular o compu (la misma tecnología que usa la app
//      para los avisos a las personas), SI definió la variable ALERTAS_USER_ID con
//      su id de usuaria y tiene las notificaciones activadas en la app.
//   2. Queda registrada en la tabla data_alerts (migración 0040) y se ve en
//      /api/estado-datos, con todas las fuentes y su frescura.
//
// Se avisa UNA vez por día y por dato: si la misma alerta sigue al día siguiente,
// avisa de nuevo (para que no se quede olvidada), pero no cada cinco minutos.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Alerta } from '../../src/app/lib/inversiones/mercadoTipos.js';
import { configurarPush, enviarAviso, type Suscripcion } from '../_notificaciones/enviar.js';

type FilaAlerta = { day: string; key: string; severity: 'aviso' | 'grave'; message: string };

/** Anota las alertas nuevas del día y avisa por push de las que no estaban. Devuelve las que se avisaron. */
export async function registrarYAvisar(db: SupabaseClient | null, alertas: Alerta[], dia: string): Promise<Alerta[]> {
  if (!db || alertas.length === 0) return [];
  const filas: FilaAlerta[] = alertas.map((a) => ({ day: dia, key: a.clave, severity: a.gravedad, message: a.mensaje.slice(0, 500) }));
  let nuevas: FilaAlerta[] = [];
  try {
    // ignoreDuplicates: sólo devuelve las que NO estaban todavía hoy.
    const { data } = await db.from('data_alerts').upsert(filas, { onConflict: 'day,key', ignoreDuplicates: true }).select('day, key, severity, message');
    nuevas = (data ?? []) as FilaAlerta[];
  } catch {
    return []; // sin la migración 0040 no hay dónde anotar: no se avisa de más
  }
  if (nuevas.length === 0) return [];

  const uid = process.env.ALERTAS_USER_ID;
  if (uid && configurarPush()) {
    try {
      const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', uid);
      const graves = nuevas.filter((n) => n.severity === 'grave');
      const cuerpo = (graves.length > 0 ? graves : nuevas).slice(0, 2).map((n) => n.message).join(' · ');
      for (const s of (subs ?? []) as Suscripcion[]) {
        const r = await enviarAviso(s, {
          title: graves.length > 0 ? 'Datos de inversiones: hay un problema' : 'Datos de inversiones: algo para revisar',
          body: `${cuerpo}${nuevas.length > 2 ? ` (y ${nuevas.length - 2} más)` : ''}`.slice(0, 220),
          url: '/',
          tag: 'alerta-datos',
        });
        if (r === 'vencida' && s.id) await db.from('push_subscriptions').delete().eq('id', s.id);
      }
    } catch {
      /* el aviso es un extra: si falla, queda igual anotada */
    }
  }
  return nuevas.map((n) => ({ clave: n.key, gravedad: n.severity, mensaje: n.message }));
}

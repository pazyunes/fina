// Vercel Cron: los avisos del día. Corre sola dos veces por día (vercel.json):
//
//   · ?tipo=paso  — 19 hs de Argentina: "tu paso de hoy", a quien todavía no
//                   sumó a su racha hoy;
//   · ?tipo=racha — 21:30 de Argentina: a quien tiene una racha de 2 días o más
//                   y hoy todavía no sumó.
//
// Usa service_role porque tiene que ver a todas las personas con
// notificaciones activas. Por eso sólo responde a Vercel: Vercel manda
// `Authorization: Bearer <CRON_SECRET>` en cada ejecución programada.
//
// Tono de FINA: los avisos recuerdan, no retan. Nunca "vas a perder tu racha".

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PASOS } from '../src/app/api/v2/pasos.js';
import { diaAR } from './_recomendaciones/fechas.js';
import { configurarPush, enviarAviso, type Aviso, type Suscripcion } from './_notificaciones/enviar.js';

type Req = { headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Tipo = 'paso' | 'racha';
type Racha = { dias: number; hoyCumplido: boolean };
type FilaSuscripcion = Suscripcion & { id: string; user_id: string };

const TITULO_PASO = new Map(PASOS.map((p) => [p.clave as string, p.titulo]));

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');

  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) { res.status(401).json({ error: 'No autorizado' }); return; }

  const tipoPedido = Array.isArray(req.query?.tipo) ? req.query?.tipo[0] : req.query?.tipo;
  if (tipoPedido !== 'paso' && tipoPedido !== 'racha') { res.status(400).json({ error: 'tipo tiene que ser paso o racha' }); return; }
  const tipo: Tipo = tipoPedido;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) { res.status(500).json({ error: 'Falta configurar Supabase en el servidor' }); return; }
  if (!configurarPush()) { res.status(500).json({ error: 'Faltan las claves VAPID' }); return; }

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
  const hoy = diaAR(Date.now());

  const { data: subs, error: errorSubs } = await supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
  if (errorSubs) { res.status(500).json({ error: errorSubs.message }); return; }

  const porPersona = new Map<string, FilaSuscripcion[]>();
  for (const s of (subs ?? []) as FilaSuscripcion[]) porPersona.set(s.user_id, [...(porPersona.get(s.user_id) ?? []), s]);

  const { data: prefs } = await supabase.from('notification_prefs').select('user_id, paso, racha').in('user_id', [...porPersona.keys()]);
  const quiere = new Map(((prefs ?? []) as { user_id: string; paso: boolean; racha: boolean }[]).map((p) => [p.user_id, p]));

  const resumen = { personas: porPersona.size, enviadas: 0, salteadas: 0, vencidas: 0, errores: 0 };

  for (const [uid, susc] of porPersona) {
    // Sin fila de preferencias = los dos avisos activados.
    const pref = quiere.get(uid);
    if (pref && !pref[tipo]) { resumen.salteadas++; continue; }

    const aviso = await armarAviso(supabase, tipo, uid, hoy);
    if (!aviso) { resumen.salteadas++; continue; }

    // Primero se anota que se manda hoy: si la tarea corre dos veces, la
    // segunda choca con esta fila y no vuelve a mandar.
    const { data: anotado } = await supabase
      .from('notification_log')
      .upsert({ user_id: uid, tipo, dia: hoy }, { onConflict: 'user_id,tipo,dia', ignoreDuplicates: true })
      .select('user_id');
    if (!anotado || anotado.length === 0) { resumen.salteadas++; continue; }

    let enviadas = 0;
    for (const s of susc) {
      const r = await enviarAviso(s, aviso);
      if (r === 'ok') enviadas++;
      else if (r === 'vencida') { resumen.vencidas++; await supabase.from('push_subscriptions').delete().eq('id', s.id); }
      else resumen.errores++;
    }
    resumen.enviadas += enviadas;
    await supabase.from('notification_log').update({ enviadas }).eq('user_id', uid).eq('tipo', tipo).eq('dia', hoy);
  }

  res.status(200).json({ tipo, dia: hoy, ...resumen });
}

async function armarAviso(supabase: SupabaseClient, tipo: Tipo, uid: string, hoy: string): Promise<Aviso | null> {
  const { data: rachaData, error } = await supabase.rpc('racha_de', { p_user: uid });
  if (error) return null;
  const racha = rachaData as Racha;
  // Si hoy ya sumó (paso cumplido o gasto por WhatsApp), no hay nada que recordar.
  if (racha.hoyCumplido) return null;

  if (tipo === 'racha') {
    if (racha.dias < 2) return null;
    return {
      title: `Tu racha de ${racha.dias} días`,
      body: 'Hoy todavía no sumaste. Con registrar un gasto, acá o por WhatsApp, alcanza.',
      url: '/onboarding-v2/home',
      tag: 'fina-racha',
    };
  }

  const { data: paso } = await supabase.from('daily_steps').select('step_key, completed_at, message').eq('user_id', uid).eq('day', hoy).maybeSingle();
  const fila = paso as { step_key: string; completed_at: string | null; message: string | null } | null;
  if (fila?.completed_at) return null;
  const titulo = fila ? TITULO_PASO.get(fila.step_key) : null;
  return titulo
    ? { title: 'Tu paso de hoy', body: `${titulo}. ${fila?.message ?? 'Lo hacés en un minuto.'}`.slice(0, 180), url: '/onboarding-v2/home', tag: 'fina-paso' }
    // Todavía no entró hoy, así que no tiene paso asignado: se lo invita a verlo.
    : { title: 'Tu paso de hoy te espera', body: 'Entrá a FINA y fijate qué te toca hoy. Lo hacés en un minuto.', url: '/onboarding-v2/home', tag: 'fina-paso' };
}

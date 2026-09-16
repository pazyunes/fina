// Vercel Cron: los avisos del día. Corre sola dos veces por día (vercel.json),
// y en cada turno le manda a cada persona COMO MUCHO UN aviso:
//
//   · ?turno=manana — 10 hs de Argentina:
//       – "día de separar", el día del mes en que cobra (si lo cargó);
//       – si no, los lunes, el resumen de la semana anterior.
//   · ?turno=tarde  — 19 hs de Argentina, sólo a quien hoy todavía no sumó:
//       – si tiene una racha de 2 días o más, el de la racha;
//       – si no, el del paso del día.
//
// Máximo dos avisos por día. Cada tipo se apaga desde Perfil.
//
// Usa service_role porque tiene que ver a todas las personas con avisos
// activos. Por eso sólo responde a Vercel: Vercel manda
// `Authorization: Bearer <CRON_SECRET>` en cada ejecución programada.
//
// Tono de FINA: los avisos recuerdan, no retan. Nunca "vas a perder tu racha".

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PASOS } from '../src/app/api/v2/pasos.js';
import { diaAR, diaDeSemana, diasDelMes, lunesDe, sumarDias } from './_recomendaciones/fechas.js';
import { configurarPush, enviarAviso, type Aviso, type Suscripcion } from './_notificaciones/enviar.js';

type Req = { headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Turno = 'manana' | 'tarde';
type Tipo = 'paso' | 'racha' | 'separar' | 'resumen';
type Racha = { dias: number; hoyCumplido: boolean };
type FilaSuscripcion = Suscripcion & { id: string; user_id: string };
// Con `select('*')`: si todavía no se corrió la 0031, las columnas nuevas no
// vienen y valen sus valores por defecto, en vez de romper la tarea entera.
type Prefs = { paso?: boolean; racha?: boolean; separar?: boolean; resumen?: boolean; dia_cobro?: number | null };

const TITULO_PASO = new Map(PASOS.map((p) => [p.clave as string, p.titulo]));

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');

  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) { res.status(401).json({ error: 'No autorizado' }); return; }

  const turnoPedido = Array.isArray(req.query?.turno) ? req.query?.turno[0] : req.query?.turno;
  if (turnoPedido !== 'manana' && turnoPedido !== 'tarde') { res.status(400).json({ error: 'turno tiene que ser manana o tarde' }); return; }
  const turno: Turno = turnoPedido;

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

  const { data: prefs } = await supabase.from('notification_prefs').select('*').in('user_id', [...porPersona.keys()]);
  const prefsDe = new Map(((prefs ?? []) as (Prefs & { user_id: string })[]).map((p) => [p.user_id, p]));

  const resumen = { turno, dia: hoy, personas: porPersona.size, enviadas: 0, salteadas: 0, vencidas: 0, errores: 0, porTipo: {} as Record<string, number> };

  for (const [uid, susc] of porPersona) {
    // Sin fila de preferencias = todos los avisos activados.
    const pref: Prefs = prefsDe.get(uid) ?? {};
    let elegido: { tipo: Tipo; aviso: Aviso } | null = null;
    try {
      elegido = turno === 'manana' ? await avisoDeLaManana(supabase, uid, hoy, pref) : await avisoDeLaTarde(supabase, uid, hoy, pref);
    } catch (e) {
      console.error('[notificaciones] armar aviso:', uid, e instanceof Error ? e.message : e);
    }
    if (!elegido) { resumen.salteadas++; continue; }

    // Primero se anota que se manda hoy (uno por turno: 'paso' para la tarde,
    // el tipo elegido para la mañana). Si la tarea corre dos veces, la segunda
    // choca con esta fila y no vuelve a mandar.
    const tipoLog: Tipo = turno === 'tarde' ? 'paso' : elegido.tipo;
    const { data: anotado } = await supabase
      .from('notification_log')
      .upsert({ user_id: uid, tipo: tipoLog, dia: hoy }, { onConflict: 'user_id,tipo,dia', ignoreDuplicates: true })
      .select('user_id');
    if (!anotado || anotado.length === 0) { resumen.salteadas++; continue; }

    let enviadas = 0;
    for (const s of susc) {
      const r = await enviarAviso(s, elegido.aviso);
      if (r === 'ok') enviadas++;
      else if (r === 'vencida') { resumen.vencidas++; await supabase.from('push_subscriptions').delete().eq('id', s.id); }
      else resumen.errores++;
    }
    resumen.enviadas += enviadas;
    resumen.porTipo[elegido.tipo] = (resumen.porTipo[elegido.tipo] ?? 0) + 1;
    await supabase.from('notification_log').update({ enviadas }).eq('user_id', uid).eq('tipo', tipoLog).eq('dia', hoy);
  }

  res.status(200).json(resumen);
}

// ── La mañana: separar o resumen ─────────────────────────────────────────

async function avisoDeLaManana(supabase: SupabaseClient, uid: string, hoy: string, pref: Prefs): Promise<{ tipo: Tipo; aviso: Aviso } | null> {
  // El día de cobro manda sobre el resumen: separar apenas entra la plata es lo
  // que más mueve. Si cae un lunes, ese lunes no hay resumen.
  if (pref.separar !== false && pref.dia_cobro) {
    const diaDelMes = Number(hoy.slice(8, 10));
    const diaDeCobroEsteMes = Math.min(pref.dia_cobro, diasDelMes(hoy));
    if (diaDelMes === diaDeCobroEsteMes) {
      const aviso = await armarSeparar(supabase, uid);
      if (aviso) return { tipo: 'separar', aviso };
    }
  }
  if (pref.resumen !== false && diaDeSemana(hoy) === 0) {
    const aviso = await armarResumenSemanal(supabase, uid, hoy);
    if (aviso) return { tipo: 'resumen', aviso };
  }
  return null;
}

const pesos = (n: number, moneda = 'ARS') =>
  `${moneda === 'USD' ? 'US$' : '$'}${Math.round(n).toLocaleString('es-AR')}`;

async function armarSeparar(supabase: SupabaseClient, uid: string): Promise<Aviso | null> {
  const { data: objetivos } = await supabase
    .from('goals')
    .select('id, title, currency, goal_contributions(occurred_at)')
    .eq('user_id', uid)
    .eq('status', 'active');
  const lista = (objetivos ?? []) as { id: string; title: string; currency: string; goal_contributions: { occurred_at: string }[] | null }[];

  if (lista.length === 0) {
    return {
      title: 'Hoy cobrás',
      body: 'Buen momento para separar una parte apenas entra, antes de empezar a gastar.',
      url: '/onboarding-v2/objetivos',
      tag: 'fina-separar',
    };
  }

  // El objetivo al que viene aportando (el del último aporte); si nunca aportó,
  // el primero.
  const ultimo = (o: (typeof lista)[number]) => Math.max(0, ...(o.goal_contributions ?? []).map((c) => Date.parse(c.occurred_at)));
  const objetivo = [...lista].sort((a, b) => ultimo(b) - ultimo(a))[0];

  // El plan que armó la IA para ese objetivo, si hay.
  const { data: planes } = await supabase
    .from('recommendations')
    .select('clave, contenido')
    .eq('user_id', uid)
    .eq('periodo', 'objetivo')
    .like('clave', `%:${objetivo.id}`)
    .order('created_at', { ascending: false })
    .limit(1);
  const rango = ((planes ?? [])[0] as { contenido: { separarPorSemana?: { min: number; max: number } | null } | null } | undefined)
    ?.contenido?.separarPorSemana;

  return {
    title: 'Hoy cobrás: buen día para separar',
    body: rango && rango.max > 0
      ? `Para “${objetivo.title}”, tu plan dice entre ${pesos(rango.min, objetivo.currency)} y ${pesos(rango.max, objetivo.currency)} por semana. Separalo apenas entra.`
      : `Separá una parte para “${objetivo.title}” apenas entra la plata, antes de empezar a gastar.`,
    url: '/onboarding-v2/objetivos?abrir=aporte_objetivo',
    tag: 'fina-separar',
  };
}

async function armarResumenSemanal(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  // La semana anterior entera, de lunes a domingo, y la de antes para comparar.
  const lunes = sumarDias(lunesDe(hoy), -7);
  const lunesAntes = sumarDias(lunes, -7);
  const desde = `${lunesAntes}T00:00:00-03:00`;

  const [gastos, aportes] = await Promise.all([
    supabase.from('transactions').select('amount_ars, occurred_at, created_at')
      .eq('user_id', uid).eq('type', 'expense').gte('created_at', desde),
    supabase.from('goal_contributions').select('amount_ars, occurred_at')
      .eq('user_id', uid).gte('occurred_at', `${lunes}T00:00:00-03:00`),
  ]);
  const filas = (gastos.data ?? []) as { amount_ars: number; occurred_at: string; created_at: string }[];
  const enSemana = (iso: string, inicio: string) => { const d = diaAR(iso); return d >= inicio && d <= sumarDias(inicio, 6); };

  const diasRegistrados = new Set(filas.filter((g) => enSemana(g.created_at, lunes)).map((g) => diaAR(g.created_at))).size;
  const gastado = filas.filter((g) => enSemana(g.occurred_at, lunes)).reduce((s, g) => s + Number(g.amount_ars), 0);
  const gastadoAntes = filas.filter((g) => enSemana(g.occurred_at, lunesAntes)).reduce((s, g) => s + Number(g.amount_ars), 0);
  const aportado = ((aportes.data ?? []) as { amount_ars: number; occurred_at: string }[])
    .filter((a) => enSemana(a.occurred_at, lunes))
    .reduce((s, a) => s + Number(a.amount_ars), 0);

  // Una semana sin nada no se resume: sería un aviso que sólo dice "no hiciste
  // nada", y eso es un reto.
  if (diasRegistrados === 0 && aportado === 0) return null;

  const partes = [`Registraste ${diasRegistrados} de 7 días`];
  if (gastado > 0) {
    // Todo número con su referencia: contra la semana anterior, si hubo.
    partes.push(gastadoAntes > 0 ? `gastaste ${pesos(gastado)} (la anterior, ${pesos(gastadoAntes)})` : `gastaste ${pesos(gastado)}`);
  }
  if (aportado > 0) partes.push(`le sumaste ${pesos(aportado)} a tus objetivos`);

  return {
    title: 'Tu semana en FINA',
    body: `${partes.join(', ')}. Arranca otra semana.`,
    url: '/onboarding-v2/home',
    tag: 'fina-resumen',
  };
}

// ── La tarde: racha o paso ───────────────────────────────────────────────

async function avisoDeLaTarde(supabase: SupabaseClient, uid: string, hoy: string, pref: Prefs): Promise<{ tipo: Tipo; aviso: Aviso } | null> {
  const { data: rachaData, error } = await supabase.rpc('racha_de', { p_user: uid });
  if (error) return null;
  const racha = rachaData as Racha;
  // Si hoy ya sumó (paso cumplido o gasto por WhatsApp), no hay nada que recordar.
  if (racha.hoyCumplido) return null;

  if (pref.racha !== false && racha.dias >= 2) {
    return {
      tipo: 'racha',
      aviso: {
        title: `Tu racha de ${racha.dias} días`,
        body: 'Hoy todavía no sumaste. Con registrar un gasto, acá o por WhatsApp, alcanza.',
        url: '/onboarding-v2/home',
        tag: 'fina-racha',
      },
    };
  }
  if (pref.paso === false) return null;

  const { data: paso } = await supabase.from('daily_steps').select('*').eq('user_id', uid).eq('day', hoy).maybeSingle();
  const fila = paso as { step_key: string; completed_at: string | null; message?: string | null } | null;
  if (fila?.completed_at) return null;
  const titulo = fila ? TITULO_PASO.get(fila.step_key) : null;
  return {
    tipo: 'paso',
    aviso: titulo
      ? { title: 'Tu paso de hoy', body: `${titulo}. ${fila?.message ?? 'Lo hacés en un minuto.'}`.slice(0, 180), url: '/onboarding-v2/home', tag: 'fina-paso' }
      // Todavía no entró hoy, así que no tiene paso asignado: se la invita a verlo.
      : { title: 'Tu paso de hoy te espera', body: 'Entrá a FINA y fijate qué te toca hoy. Lo hacés en un minuto.', url: '/onboarding-v2/home', tag: 'fina-paso' },
  };
}

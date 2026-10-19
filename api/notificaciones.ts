// Vercel Cron: los avisos del día. Corre sola dos veces por día (vercel.json),
// y en cada turno le manda a cada persona COMO MUCHO UN aviso:
//
//   · ?turno=manana — 10 hs de Argentina:
//       – un gasto fijo que vence hoy o mañana;
//       – si no, "día de separar", el día del mes en que cobra (si lo cargó);
//       – si no, los lunes, el resumen de la semana anterior.
//   · ?turno=tarde, 19 hs de Argentina, si hoy no hay gastos anotados:
//       – con racha de 2 días o más: el de la racha, que pide contarle a FINA
//         lo de hoy (anotar un gasto salva el día);
//       – si no: el recordatorio de anotar lo de hoy.
//
// Desde la migración 0042 no hay paso del día: la racha cuenta los días con
// un gasto anotado, y el próximo paso es uno grande que la persona marca en
// Inicio. La preferencia 'paso' apaga el recordatorio de anotar (sin
// migración nueva).
//
// Máximo dos avisos por día. Cada tipo se apaga desde Perfil.
//
// Usa service_role porque tiene que ver a todas las personas con avisos
// activos. Por eso sólo responde a Vercel: Vercel manda
// `Authorization: Bearer <CRON_SECRET>` en cada ejecución programada.
//
// Tono de FINA: los avisos recuerdan, no retan. Nunca "vas a perder tu racha".

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { diaAR, diaDeSemana, diasDelMes, lunesDe, sumarDias } from './_recomendaciones/fechas.js';
import { configurarPush, enviarAviso, type Aviso, type Suscripcion } from './_notificaciones/enviar.js';
import { avisoDePlazo, type ObjetivoConAportes } from './_notificaciones/plazos.js';

type Req = { headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Turno = 'manana' | 'tarde';
type Tipo = 'paso' | 'racha' | 'separar' | 'resumen' | 'vencimiento' | 'registro' | 'plazo';
type Racha = { dias: number; hoyCumplido: boolean };
type FilaSuscripcion = Suscripcion & { id: string; user_id: string };
// Con `select('*')`: si todavía no se corrió la 0031, las columnas nuevas no
// vienen y valen sus valores por defecto, en vez de romper la tarea entera.
type Prefs = { paso?: boolean; racha?: boolean; separar?: boolean; resumen?: boolean; vencimientos?: boolean; dia_cobro?: number | null };

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

// ── La mañana: vencimiento, separar o resumen ────────────────────────────

async function avisoDeLaManana(supabase: SupabaseClient, uid: string, hoy: string, pref: Prefs): Promise<{ tipo: Tipo; aviso: Aviso } | null> {
  // Un pago que vence es lo único con fecha que no se mueve: va primero.
  if (pref.vencimientos !== false) {
    const aviso = await armarVencimiento(supabase, uid, hoy);
    if (aviso) return { tipo: 'vencimiento', aviso };
  }
  // El plazo de un objetivo va antes que el día de cobro porque tiene fecha.
  // Usa la preferencia de "separar", que es la de los avisos de objetivos.
  // Antes de la migración 0041 el registro en notification_log falla y el aviso
  // simplemente no sale (ver api/_notificaciones/plazos.ts).
  if (pref.separar !== false) {
    const aviso = await armarPlazo(supabase, uid, hoy);
    if (aviso) return { tipo: 'plazo', aviso };
  }
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

async function armarPlazo(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  // Una vez por semana por persona (y por lo tanto por objetivo).
  const { data: log } = await supabase.from('notification_log')
    .select('dia').eq('user_id', uid).eq('tipo', 'plazo')
    .gte('dia', sumarDias(hoy, -6)).limit(1);
  if (log && log.length > 0) return null;
  const { data, error } = await supabase.from('goals')
    .select('id, title, currency, amount_ars, horizon_label, status, goal_contributions(amount, currency, amount_ars, occurred_at)')
    .eq('user_id', uid).eq('status', 'active');
  if (error || !data) return null;
  const { data: cot } = await supabase.from('exchange_rates')
    .select('rate').eq('currency', 'USD_BLUE').order('fetched_at', { ascending: false }).limit(1).maybeSingle();
  const dolar = cot ? Number((cot as { rate: number }).rate) : null;
  return avisoDePlazo(data as ObjetivoConAportes[], hoy, { dolar });
}

const pesos = (n: number, moneda = 'ARS') =>
  `${moneda === 'USD' ? 'US$' : '$'}${Math.round(n).toLocaleString('es-AR')}`;

async function armarVencimiento(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  const manana = sumarDias(hoy, 1);
  // Sin la migración 0034 la tabla no existe: error → sin aviso, sigue lo demás.
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('description, amount, currency, next_due')
    .eq('user_id', uid).eq('active', true)
    .in('next_due', [hoy, manana])
    .order('next_due', { ascending: true });
  if (error || !data || data.length === 0) return null;
  const filas = data as { description: string; amount: number; currency: string; next_due: string }[];

  // Se avisa el día anterior y el mismo día; si ya pasó, no se insiste.
  const cuando = filas[0].next_due === hoy ? 'Hoy' : 'Mañana';
  const delDia = filas.filter((f) => f.next_due === filas[0].next_due);
  const titulo = delDia.length === 1
    ? `${cuando} vence ${delDia[0].description}`
    : `${cuando} vencen ${delDia.length} gastos fijos`;
  const detalle = delDia.length === 1
    ? `Son ${pesos(delDia[0].amount, delDia[0].currency)}.`
    : `${delDia.map((f) => `${f.description} (${pesos(f.amount, f.currency)})`).join(', ')}.`;
  return {
    title: titulo,
    body: `${detalle} Cuando lo pagues, marcalo en FINA y queda registrado.`.slice(0, 180),
    url: '/onboarding-v2/gastos?abrir=fijos',
    tag: 'fina-vencimiento',
  };
}

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
      ? `Para "${objetivo.title}", tu plan dice entre ${pesos(rango.min, objetivo.currency)} y ${pesos(rango.max, objetivo.currency)} por semana. Separalo apenas entra.`
      : `Separá una parte para "${objetivo.title}" apenas entra la plata, antes de empezar a gastar.`,
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

// ── La tarde: registro, racha o paso ─────────────────────────────────────

/** Si hoy (en Argentina) hay algún gasto anotado: cargado hoy o con fecha de hoy. */
async function hayGastoHoy(supabase: SupabaseClient, uid: string, hoy: string): Promise<boolean | null> {
  // En UTC: dentro de un `or` de PostgREST, un "-03:00" suelto es más frágil.
  const desde = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('type', 'expense')
    .or(`created_at.gte.${desde},occurred_at.gte.${desde}`);
  return error ? null : (count ?? 0) > 0;
}

async function avisoDeLaTarde(supabase: SupabaseClient, uid: string, hoy: string, pref: Prefs): Promise<{ tipo: Tipo; aviso: Aviso } | null> {
  const { data: rachaData, error } = await supabase.rpc('racha_de', { p_user: uid });
  if (error) return null;
  const racha = rachaData as Racha;
  // Si no se pudo saber, se asume que hay: mejor no recordar que recordar de más.
  const sinGastoHoy = (await hayGastoHoy(supabase, uid, hoy)) === false;

  // Racha en juego y nada anotado hoy: un solo aviso con las dos cosas. Contarle
  // un gasto a FINA por WhatsApp anota lo de hoy y salva la racha a la vez.
  if (!racha.hoyCumplido && pref.racha !== false && racha.dias >= 2) {
    return {
      tipo: 'racha',
      aviso: {
        title: `Tu racha de ${racha.dias} días`,
        body: sinGastoHoy
          ? 'Hoy todavía no sumaste. Contale a FINA por WhatsApp lo que gastaste hoy y queda a salvo.'
          : 'Hoy todavía no sumaste. Con anotar un gasto, alcanza.',
        url: '/onboarding-v2/home',
        tag: 'fina-racha',
      },
    };
  }
  // La preferencia 'paso' quedó como la del recordatorio de anotar lo del
  // día (sin migración nueva): el paso diario ya no existe (migración 0042).
  if (pref.paso === false || !sinGastoHoy) return null;
  return {
    tipo: 'registro',
    aviso: {
      title: '¿Anotaste lo de hoy?',
      body: 'Si gastaste algo, contáselo a FINA por WhatsApp o anotalo en la app. Te lleva un minuto.',
      url: '/onboarding-v2/home',
      tag: 'fina-registro',
    },
  };
}

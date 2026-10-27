// Vercel Cron: los avisos del día. Corre sola dos veces por día (vercel.json),
// y en cada turno le manda a cada persona COMO MUCHO UN aviso:
//
//   · ?turno=manana — 10 hs de Argentina:
//       – un gasto fijo que vence hoy o mañana;
//       – si no, "día de separar", el día del mes en que cobra (si lo cargó);
//       – si no, el 1.º de cada mes, el cierre del mes que terminó;
//       – si no, los lunes, el resumen de la semana anterior.
//   · ?turno=tarde, 19 hs de Argentina, si hoy no hay gastos anotados:
//       – con racha de 2 días o más: el de la racha, que pide contarle a FINA
//         lo de hoy (anotar un gasto salva el día);
//       – si no, un gasto que suele anotar ese día de la semana y todavía no
//         anotó hoy ("¿Hoy gastaste en café?");
//       – si no: el recordatorio de anotar lo de hoy.
//
// Desde la migración 0044 no hay paso del día: la racha cuenta los días con
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
import { avisoDeInversionQueVence, type InversionQueVence } from './_notificaciones/inversiones.js';
import { detectarHabitos, habitosDeHoy, SEMANAS_QUE_SE_MIRAN } from '../src/app/lib/habitos.js';

type Req = { headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Turno = 'manana' | 'tarde';
type Tipo = 'paso' | 'racha' | 'separar' | 'resumen' | 'vencimiento' | 'registro';
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
  if (pref.resumen !== false && hoy.slice(8, 10) === '01') {
    const aviso = await armarCierreDeMes(supabase, uid, hoy);
    if (aviso) return { tipo: 'resumen', aviso };
  }
  if (pref.resumen !== false && diaDeSemana(hoy) === 0) {
    const aviso = await armarResumenSemanal(supabase, uid, hoy);
    if (aviso) return { tipo: 'resumen', aviso };
  }
  return null;
}

const pesos = (n: number, moneda = 'ARS') =>
  `${moneda === 'USD' ? 'US$' : '$'}${Math.round(n).toLocaleString('es-AR')}`;

async function armarVencimiento(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  const manana = sumarDias(hoy, 1);
  // Primero el gasto fijo (un pago atrasado cuesta); si no hay, una inversión que termina.
  return (await armarGastoFijoQueVence(supabase, uid, hoy, manana)) ?? (await armarInversionQueVence(supabase, uid, hoy, manana));
}

async function armarInversionQueVence(supabase: SupabaseClient, uid: string, hoy: string, manana: string): Promise<Aviso | null> {
  // Sin la migración 0039 la tabla no existe: error → sin aviso.
  const { data, error } = await supabase
    .from('investment_positions')
    .select('kind, provider, amount, currency, end_date, details')
    .eq('user_id', uid).eq('status', 'activa')
    .in('end_date', [hoy, manana]);
  if (error || !data) return null;
  return avisoDeInversionQueVence(data as InversionQueVence[], hoy, manana);
}

async function armarGastoFijoQueVence(supabase: SupabaseClient, uid: string, hoy: string, manana: string): Promise<Aviso | null> {
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
      ? `Para “${objetivo.title}”, tu plan dice entre ${pesos(rango.min, objetivo.currency)} y ${pesos(rango.max, objetivo.currency)} por semana. Separalo apenas entra.`
      : `Separá una parte para “${objetivo.title}” apenas entra la plata, antes de empezar a gastar.`,
    url: '/onboarding-v2/objetivos?abrir=aporte_objetivo',
    tag: 'fina-separar',
  };
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** El 1.º del mes: si anotó gastos en el mes que terminó, un aviso que abre su cierre. */
async function armarCierreDeMes(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  const anterior = mes === 1 ? { a: anio - 1, m: 12 } : { a: anio, m: mes - 1 };
  const desde = `${anterior.a}-${String(anterior.m).padStart(2, '0')}-01`;
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid).eq('type', 'expense')
    .gte('occurred_at', `${desde}T00:00:00-03:00`)
    .lt('occurred_at', `${hoy}T00:00:00-03:00`);
  if (error || !count) return null;
  const nombre = MESES[anterior.m - 1];
  return {
    title: `Cómo cerró ${nombre}`,
    body: `Mirá cómo te fue y armá ${MESES[mes - 1]}.`,
    url: '/onboarding-v2/home?abrir=cierre',
    tag: 'fina-cierre',
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

// ── La tarde: registro o racha ───────────────────────────────────────────

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
  const gastoHoy = await hayGastoHoy(supabase, uid, hoy);
  const sinGastoHoy = gastoHoy === false;

  // Racha en juego y nada anotado hoy: un solo aviso con las dos cosas. Contarle
  // un gasto a FINA por WhatsApp anota lo de hoy y salva la racha a la vez.
  //
  // Si hay un gasto de hoy, el aviso no sale aunque la racha diga que el día no
  // está cumplido: pasa con un gasto cargado antes con fecha de hoy (la racha
  // mira `created_at`, `hayGastoHoy` también `occurred_at`), y decirle "no
  // anotaste gastos" a quien ve uno de hoy en la app sería falso. Si no se pudo
  // consultar (`null`), manda la racha, que ya sabe que hoy no se cargó nada.
  if (!racha.hoyCumplido && gastoHoy !== true && pref.racha !== false && racha.dias >= 2) {
    return {
      tipo: 'racha',
      aviso: {
        title: `Tu racha de ${racha.dias} días`,
        body: sinGastoHoy
          ? 'Hoy todavía no anotaste gastos. Contale a FINA por WhatsApp lo que gastaste y la racha queda a salvo.'
          : 'Hoy todavía no anotaste gastos.',
        url: '/onboarding-v2/home',
        tag: 'fina-racha',
      },
    };
  }
  // La preferencia 'paso' quedó como la del recordatorio de anotar lo del
  // día (sin migración nueva): el paso diario ya no existe (migración 0044).
  if (pref.paso === false) return null;

  // Un gasto de los que suele anotar este día de la semana y todavía no anotó.
  const habito = await armarHabito(supabase, uid, hoy);
  if (habito) return { tipo: 'registro', aviso: habito };
  if (!sinGastoHoy) return null;
  return {
    tipo: 'registro',
    aviso: {
      title: 'Anotá tus gastos de hoy',
      body: 'Si gastaste algo, contáselo a FINA por WhatsApp o anotalo en la app.',
      url: '/onboarding-v2/home',
      tag: 'fina-registro',
    },
  };
}


/** Un gasto que la persona suele anotar este día de la semana y hoy todavía no anotó. */
async function armarHabito(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
  const desde = sumarDias(hoy, -(SEMANAS_QUE_SE_MIRAN * 7 + 1));
  const { data, error } = await supabase
    .from('transactions')
    .select('description, amount_ars, occurred_at, section_id')
    .eq('user_id', uid).eq('type', 'expense')
    .gte('occurred_at', `${desde}T00:00:00-03:00`)
    .limit(1000);
  if (error || !data) return null;
  const gastos = (data as { description: string | null; amount_ars: number; occurred_at: string; section_id: string | null }[])
    .filter((g) => g.description && !/\{\{.*\}\}/.test(g.description))
    .map((g) => ({ descripcion: g.description as string, monto: Number(g.amount_ars), fecha: diaAR(g.occurred_at), seccionId: g.section_id }));

  const habito = habitosDeHoy(detectarHabitos(gastos, hoy), gastos, hoy)[0];
  if (!habito) return null;

  const datos = new URLSearchParams({ abrir: 'gasto', descripcion: habito.descripcion });
  if (habito.montoTipico > 0) datos.set('monto', String(habito.montoTipico));
  if (habito.seccionId) datos.set('seccion', habito.seccionId);
  return {
    title: `¿Hoy gastaste en ${habito.descripcion}?`.slice(0, 80),
    body: 'Si fue así, anotalo en un toque y queda registrado.',
    url: `/onboarding-v2/gastos?${datos.toString()}`,
    tag: 'fina-habito',
  };
}

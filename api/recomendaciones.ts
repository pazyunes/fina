// Vercel Serverless Function: el "agente" de FINA.
//
// Una sola llamada al modelo, como mucho una vez por día por persona, que arma
// todo lo que en la app necesita pensar sobre sus datos:
//
//   · las recomendaciones de Home: del día, de la semana y del mes;
//   · el paso del día de MAÑANA, elegido entre los que puede cumplir y con un
//     mensaje que le habla a ella (junto con la del día);
//   · un plan para cada objetivo en curso: cuánto separar por semana según su
//     ritmo real (junto con la de la semana, o sea una vez por semana).
//
// Todo comparte la misma memoria de la persona (`recommendation_memory`) y el
// mismo seguimiento de qué funcionó: lo que aprende mirando sus gastos le sirve
// para el paso, y lo que aprende de qué pasos cumple le sirve para recomendar.
//
// Corre en el servidor, nunca en el navegador: la clave de Anthropic no puede
// llegar al teléfono de nadie. Por eso se lee de ANTHROPIC_API_KEY y NO de una
// variable VITE_*, que Vite mete dentro del código que se descarga.
//
// Actúa COMO la persona: arma el cliente de Supabase con su token, así que las
// policies de siempre (cada una sólo ve y escribe lo suyo) valen también acá.
// No usa service_role, así que un error en esta función no puede leer ni
// escribir datos de otra cuenta.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PASOS } from '../src/app/api/v2/pasos.js';
import { claveMes, claveSemana, diaAR, sumarDias } from './_recomendaciones/fechas.js';
import {
  SISTEMA, Respuesta, armarMensaje, normalizar,
  type PasoMananaModelo, type PlanObjetivoModelo, type RecomendacionModelo, type RespuestaModelo,
} from './_recomendaciones/prompt.js';
import {
  armarPasosRecientes, armarResumen, armarSeguimiento, suficiencia,
  type Entrada, type FilaGasto, type FilaMedio, type FilaObjetivo, type FilaPasoDelDia, type FilaPerfil,
  type FilaRecomendacion, type FilaSeccion, type Observacion, type Racha,
} from './_recomendaciones/resumen.js';
import { revisarRecomendacion, revisarTexto, type Problema } from './_recomendaciones/tono.js';

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Periodo = 'dia' | 'semana' | 'mes';
const PERIODOS: Periodo[] = ['dia', 'semana', 'mes'];

export type Tarjeta =
  | { estado: 'lista'; id: string; contenido: RecomendacionModelo; util: boolean | null }
  | { estado: 'faltan_datos'; mensaje: string }
  | { estado: 'sin_recomendacion' }
  | { estado: 'no_configurado' }
  | { estado: 'error'; mensaje: string };

// Sonnet 5: muy buena calidad para interpretar datos que ya le llegan
// calculados, a menos de la mitad del precio por palabra que Opus. Cambiar de
// modelo es esta línea.
const MODELO = 'claude-sonnet-5';
const ESPERA_ENTRE_INTENTOS = 20 * 60 * 1000;

// El paso de mañana nunca puede ser "registrá tu primer gasto": ese lo decide
// la regla (va primero siempre que no haya gastos), no el modelo.
const PASOS_ELEGIBLES = new Map(PASOS.filter((p) => p.clave !== 'primer_gasto').map((p) => [p.clave as string, p]));
const TITULO_PASO = new Map(PASOS.map((p) => [p.clave as string, p.titulo]));

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'Sólo GET' }); return; }

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) { res.status(500).json({ error: 'Supabase no configurado en el servidor' }); return; }

  const auth = req.headers.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Falta la sesión' }); return; }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: sesion, error: errorSesion } = await supabase.auth.getUser(token);
  if (errorSesion || !sesion.user) { res.status(401).json({ error: 'Sesión inválida' }); return; }
  const uid = sesion.user.id;

  const ahora = Date.now();
  const hoy = diaAR(ahora);
  const manana = sumarDias(hoy, 1);
  const claves: Record<Periodo, string> = { dia: hoy, semana: claveSemana(hoy), mes: claveMes(hoy) };

  // Los pasos que la persona puede cumplir mañana. Los calcula la app (es la
  // que sabe mirar sus datos con el catálogo); acá sólo se aceptan claves que
  // existen en el catálogo.
  const pedidos = String(Array.isArray(req.query?.pasos) ? req.query?.pasos[0] : req.query?.pasos ?? '')
    .split(',').map((c) => c.trim()).filter((c) => PASOS_ELEGIBLES.has(c));
  const pasosPosibles = [...new Set(pedidos)].map((c) => {
    const p = PASOS_ELEGIBLES.get(c)!;
    return { clave: p.clave as string, titulo: p.titulo, queHay: p.msg };
  });

  // ── 1. Lo que ya está generado para este día / semana / mes ────────────
  const guardadas = await leerGuardadas(supabase, claves);
  if (guardadas.error) { res.status(500).json({ error: guardadas.error }); return; }
  const tarjetas: Partial<Record<Periodo, Tarjeta>> = {};
  for (const p of PERIODOS) {
    const g = guardadas.filas.find((f) => f.periodo === p && f.clave === claves[p]);
    if (g) tarjetas[p] = aTarjeta(g);
  }
  if (PERIODOS.every((p) => tarjetas[p])) { res.status(200).json(tarjetas); return; }

  // ── 2. Los datos de la persona ─────────────────────────────────────────
  const entrada = await leerEntrada(supabase, uid, ahora);
  if ('error' in entrada) { res.status(500).json({ error: entrada.error }); return; }

  // ── 3. Para qué períodos alcanzan los datos ────────────────────────────
  // Sin datos suficientes no se llama al modelo: saldría una recomendación
  // genérica, que es justo lo que no sirve, y encima costaría plata.
  const alcanza = suficiencia(entrada);
  const aGenerar: Periodo[] = [];
  for (const p of PERIODOS) {
    if (tarjetas[p]) continue;
    const falta = alcanza[p];
    if (falta) tarjetas[p] = { estado: 'faltan_datos', mensaje: falta };
    else aGenerar.push(p);
  }
  if (aGenerar.length === 0) { res.status(200).json(tarjetas); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    for (const p of aGenerar) tarjetas[p] = { estado: 'no_configurado' };
    res.status(200).json(tarjetas);
    return;
  }

  // ── 4. Freno: ¿hubo un intento hace poco? ──────────────────────────────
  // Si una generación arrancó hace menos de 20 minutos y todavía no hay nada
  // guardado, o está en curso (otra pestaña, otro dispositivo) o falló. En los
  // dos casos, volver a llamar al modelo costaría otra vez lo mismo.
  if (entrada.ultimoIntento && ahora - Date.parse(entrada.ultimoIntento) < ESPERA_ENTRE_INTENTOS) {
    for (const p of aGenerar) tarjetas[p] = { estado: 'error', mensaje: 'Estamos armando tus recomendaciones. Volvé en un rato.' };
    res.status(200).json(tarjetas);
    return;
  }
  await supabase.from('recommendation_memory').upsert(
    { user_id: uid, ultimo_intento: new Date(ahora).toISOString() },
    { onConflict: 'user_id' },
  );

  // ── 5. Generar ─────────────────────────────────────────────────────────
  // El paso de mañana va con la del día, y los planes de los objetivos con la
  // de la semana: así salen en la misma llamada, sin costo aparte, y con la
  // frecuencia que tiene sentido para cada uno.
  const objetivosEnCurso = entrada.objetivos.filter((o) => o.status === 'active');
  const pedido: Pedido = {
    periodos: aGenerar,
    resumen: armarResumen(entrada),
    memoria: entrada.memoria,
    seguimiento: armarSeguimiento(entrada),
    pasosPosibles: aGenerar.includes('dia') && pasosPosibles.length > 0 ? pasosPosibles : null,
    pasosRecientes: armarPasosRecientes(entrada, TITULO_PASO),
    planesObjetivos: aGenerar.includes('semana') && objetivosEnCurso.length > 0,
  };
  let generada: RespuestaModelo;
  try {
    generada = await generar(apiKey, pedido);
  } catch (e) {
    const mensaje = describirError(e);
    console.error('[recomendaciones] generar:', mensaje);
    for (const p of aGenerar) tarjetas[p] = { estado: 'error', mensaje: 'No pudimos armar tus recomendaciones ahora. Probá más tarde.' };
    res.status(200).json(tarjetas);
    return;
  }

  // ── 6. Guardar y devolver ──────────────────────────────────────────────
  // "Insertar si no existe" y nunca "insertar o actualizar": desde el
  // navegador sólo se puede cambiar `util` (migración 0029), y la función
  // escribe con la sesión de la persona. Si dos dispositivos generan a la vez,
  // el segundo no pisa al primero: se queda con la que ya estaba.
  const filas: Record<string, unknown>[] = aGenerar.map((p) => {
    const r = generada[p];
    // Se guardan también los períodos sin recomendación (contenido null): si
    // no, la próxima vez que se abre Home se volvería a llamar al modelo.
    return {
      user_id: uid, periodo: p, clave: claves[p], contenido: r,
      foco_tipo: r?.foco.tipo ?? null, foco_ref: r?.foco.sobre ?? null, modelo: MODELO,
    };
  });

  // El paso de mañana, sólo si eligió uno de los que se le ofrecieron.
  const paso = generada.pasoManana;
  if (pedido.pasosPosibles && paso && pasosPosibles.some((p) => p.clave === paso.clave)) {
    filas.push({
      user_id: uid, periodo: 'paso', clave: manana, contenido: paso,
      foco_tipo: 'paso', foco_ref: paso.clave, modelo: MODELO,
    });
  }

  // Los planes, sólo de objetivos que existen y están en curso.
  if (pedido.planesObjetivos) {
    for (const plan of generada.objetivos) {
      const objetivo = objetivosEnCurso.find((o) => o.id === plan.id);
      if (!objetivo) continue;
      filas.push({
        user_id: uid, periodo: 'objetivo', clave: `${claves.semana}:${plan.id}`, contenido: plan,
        foco_tipo: 'objetivo', foco_ref: objetivo.title, modelo: MODELO,
      });
    }
  }

  const { error } = await supabase.from('recommendations').upsert(filas, { onConflict: 'user_id,periodo,clave', ignoreDuplicates: true });
  if (error) console.error('[recomendaciones] guardar:', error.message);

  await supabase.from('recommendation_memory').upsert(
    { user_id: uid, observaciones: generada.observaciones.slice(0, 8), updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );

  // Se relee: así se devuelven los ids, y si otro dispositivo ganó la carrera
  // se muestra la suya y no la que se descartó.
  const releidas = await leerGuardadas(supabase, claves);
  for (const p of aGenerar) {
    const g = releidas.filas.find((f) => f.periodo === p && f.clave === claves[p]);
    tarjetas[p] = g ? aTarjeta(g) : { estado: 'sin_recomendacion' };
  }

  res.status(200).json(tarjetas);
}

// ── Modelo ───────────────────────────────────────────────────────────────

type Pedido = {
  periodos: Periodo[];
  resumen: unknown;
  memoria: Observacion[];
  seguimiento: unknown;
  pasosPosibles: { clave: string; titulo: string; queHay: string }[] | null;
  pasosRecientes: unknown;
  planesObjetivos: boolean;
};

async function generar(apiKey: string, pedido: Pedido): Promise<RespuestaModelo> {
  // Sin reintentos automáticos y con un tiempo máximo por debajo del límite de
  // la función (60 s en vercel.json): si Vercel corta la función primero, la
  // persona recibe un error genérico en vez del mensaje amable.
  const client = new Anthropic({ apiKey, timeout: 55_000, maxRetries: 0 });

  let respuesta = await pedir(client, pedido);
  let problemas = revisar(respuesta, pedido);

  // Un reintento si algo no pasó el control de tono, diciéndole qué usó.
  if (problemas.length > 0) {
    const correcciones = [...new Set(problemas.map((x) => `"${x.problema.fragmento}" (${x.problema.porque})`))];
    respuesta = await pedir(client, pedido, correcciones);
    problemas = revisar(respuesta, pedido);
  }

  // Lo que sigue sin pasar, no se muestra. Mejor sin recomendación que una que
  // reta a la persona o se parece a un consejo de inversión. Se descarta sólo
  // la parte con problemas, no toda la respuesta.
  const malas = new Set(problemas.map((x) => x.donde));
  if (malas.size > 0) console.error('[recomendaciones] descartado por tono:', problemas);
  return {
    ...respuesta,
    dia: malas.has('dia') ? null : respuesta.dia,
    semana: malas.has('semana') ? null : respuesta.semana,
    mes: malas.has('mes') ? null : respuesta.mes,
    pasoManana: malas.has('paso') ? null : respuesta.pasoManana,
    objetivos: respuesta.objetivos.filter((o) => !malas.has(`objetivo:${o.id}`)),
  };
}

async function pedir(client: Anthropic, pedido: Pedido, correcciones?: string[]): Promise<RespuestaModelo> {
  const mensaje = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    // 'medium': los números le llegan calculados, lo que hace es interpretarlos.
    // Subirlo a 'high' piensa más y cuesta más.
    output_config: { effort: 'medium', format: betaZodOutputFormat(Respuesta) },
    // El prompt de sistema es fijo, así que se cachea: las generaciones de
    // todas las personas comparten ese prefijo.
    system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: armarMensaje({ ...pedido, correcciones }) }],
  });

  if (mensaje.stop_reason === 'refusal') throw new Error('El modelo declinó la solicitud');
  if (mensaje.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por largo');
  if (!mensaje.parsed_output) throw new Error('La respuesta no tuvo el formato esperado');
  return normalizar(mensaje.parsed_output);
}

function revisar(r: RespuestaModelo, pedido: Pedido): { donde: string; problema: Problema }[] {
  const problemas: { donde: string; problema: Problema }[] = [];
  for (const p of pedido.periodos) {
    const rec = r[p];
    if (rec) problemas.push(...revisarRecomendacion(rec).map((problema) => ({ donde: p, problema })));
  }
  const paso: PasoMananaModelo | null = r.pasoManana;
  if (paso) problemas.push(...revisarTexto('paso', paso.mensaje).map((problema) => ({ donde: 'paso', problema })));
  for (const plan of r.objetivos as PlanObjetivoModelo[]) {
    problemas.push(...[...revisarTexto('titulo', plan.titulo), ...revisarTexto('texto', plan.texto)]
      .map((problema) => ({ donde: `objetivo:${plan.id}`, problema })));
  }
  return problemas;
}

function describirError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'clave de Anthropic inválida';
  if (e instanceof Anthropic.RateLimitError) return 'límite de uso de Anthropic';
  if (e instanceof Anthropic.APIConnectionTimeoutError) return 'la generación tardó demasiado';
  if (e instanceof Anthropic.APIError) return `Anthropic ${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

// ── Supabase ─────────────────────────────────────────────────────────────

type Cliente = SupabaseClient;
type Guardada = { id: string; periodo: Periodo; clave: string; contenido: RecomendacionModelo | null; util: boolean | null };

// Una fila guardada con contenido null es "para este período no había nada útil
// que decir": se muestra así y NO se vuelve a generar.
const aTarjeta = (g: Guardada): Tarjeta => (g.contenido
  ? { estado: 'lista', id: g.id, contenido: g.contenido, util: g.util }
  : { estado: 'sin_recomendacion' });

async function leerGuardadas(supabase: Cliente, claves: Record<Periodo, string>): Promise<{ filas: Guardada[]; error: string | null }> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('id, periodo, clave, contenido, util')
    .in('periodo', PERIODOS)
    .in('clave', Object.values(claves));
  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as Guardada[], error: null };
}

async function leerEntrada(supabase: Cliente, uid: string, ahora: number): Promise<(Entrada & { ultimoIntento: string | null }) | { error: string }> {
  const hoy = diaAR(ahora);
  const hace90 = `${sumarDias(hoy, -90)}T00:00:00-03:00`;
  const hace30 = `${sumarDias(hoy, -30)}T00:00:00-03:00`;
  const hace21 = sumarDias(hoy, -21);

  const [gastos, secciones, medios, objetivos, perfil, inversor, aportes, racha, memoria, historial, pasos, pasosIA, hechas] = await Promise.all([
    supabase.from('transactions').select('amount_ars, occurred_at, created_at, section_id, expense_type, payment_method, source')
      .eq('type', 'expense').gte('occurred_at', hace90).order('occurred_at', { ascending: true }),
    supabase.from('expense_sections').select('id, name, cap_amount, cap_period').eq('archived', false),
    supabase.from('payment_methods').select('name, balance_ars'),
    supabase.from('goals').select('id, title, amount_ars, currency, amount_mode, horizon_label, status, goal_contributions(amount, occurred_at)'),
    supabase.from('user_profiles').select('main_goal, income_stability, financial_level, income_sources').eq('id', uid).maybeSingle(),
    supabase.from('investment_profiles').select('completed_at').maybeSingle(),
    supabase.from('investment_contributions').select('id', { count: 'exact', head: true }).gte('occurred_at', hace30),
    supabase.rpc('mi_racha'),
    supabase.from('recommendation_memory').select('observaciones, ultimo_intento').maybeSingle(),
    supabase.from('recommendations').select('id, periodo, clave, contenido, foco_tipo, foco_ref, util, created_at')
      .in('periodo', PERIODOS).order('created_at', { ascending: false }).limit(10),
    supabase.from('daily_steps').select('day, step_key, completed_at').gte('day', hace21).order('day', { ascending: false }),
    supabase.from('recommendations').select('clave, foco_ref').eq('periodo', 'paso').gte('clave', hace21),
    // Sin la migración 0032 la tabla no existe: se sigue sin esa señal.
    supabase.from('recommendation_checks').select('ref').like('ref', 'ia:%').gte('hecha_at', hace30),
  ]);

  const error = [gastos, secciones, medios, objetivos, perfil, inversor, aportes, memoria, historial, pasos, pasosIA].find((r) => r.error)?.error;
  if (error) return { error: error.message };

  return {
    ahora,
    gastos: (gastos.data ?? []) as FilaGasto[],
    secciones: (secciones.data ?? []) as FilaSeccion[],
    medios: (medios.data ?? []) as FilaMedio[],
    objetivos: (objetivos.data ?? []) as FilaObjetivo[],
    perfil: (perfil.data ?? null) as FilaPerfil | null,
    perfilInversorCompleto: !!(inversor.data as { completed_at: string | null } | null)?.completed_at,
    aportesUltimos30: aportes.count ?? 0,
    // La racha no es imprescindible: si la función falla, se recomienda igual.
    racha: racha.error ? null : (racha.data as Racha),
    memoria: ((memoria.data as { observaciones: Observacion[] } | null)?.observaciones ?? []),
    ultimoIntento: (memoria.data as { ultimo_intento: string | null } | null)?.ultimo_intento ?? null,
    historial: (historial.data ?? []) as FilaRecomendacion[],
    pasosDelDia: (pasos.data ?? []) as FilaPasoDelDia[],
    pasosElegidosPorIA: ((pasosIA.data ?? []) as { clave: string; foco_ref: string | null }[]).map((f) => `${f.clave}:${f.foco_ref}`),
    recomendacionesHechas: hechas.error ? [] : ((hechas.data ?? []) as { ref: string }[]).map((f) => f.ref.slice(3)),
  };
}

// Vercel Serverless Function: las recomendaciones del día, la semana y el mes.
//
// Corre en el servidor, nunca en el navegador: la clave de Anthropic no puede
// llegar al teléfono de nadie. Por eso se lee de ANTHROPIC_API_KEY y NO de una
// variable VITE_*, que Vite mete dentro del código que se descarga.
//
// Actúa COMO la persona: arma el cliente de Supabase con su token, así que las
// policies de siempre (cada una sólo ve y escribe lo suyo) valen también acá.
// No usa service_role, así que un error en esta función no puede leer ni
// escribir datos de otra cuenta.
//
// Costo: una generación por período como mucho (la del día, una vez por día).
// Si ya está guardada, se devuelve sin llamar al modelo.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { claveMes, claveSemana, diaAR, sumarDias } from './_recomendaciones/fechas.js';
import { SISTEMA, Respuesta, armarMensaje, normalizar, type RecomendacionModelo, type RespuestaModelo } from './_recomendaciones/prompt.js';
import {
  armarResumen, armarSeguimiento, suficiencia,
  type Entrada, type FilaGasto, type FilaMedio, type FilaObjetivo, type FilaPerfil, type FilaRecomendacion, type FilaSeccion, type Observacion, type Racha,
} from './_recomendaciones/resumen.js';
import { revisarRecomendacion, type Problema } from './_recomendaciones/tono.js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

type Periodo = 'dia' | 'semana' | 'mes';
const PERIODOS: Periodo[] = ['dia', 'semana', 'mes'];

export type Tarjeta =
  | { estado: 'lista'; id: string; contenido: RecomendacionModelo; util: boolean | null }
  | { estado: 'faltan_datos'; mensaje: string }
  | { estado: 'sin_recomendacion' }
  | { estado: 'no_configurado' }
  | { estado: 'error'; mensaje: string };

const MODELO = 'claude-opus-5';
const ESPERA_ENTRE_INTENTOS = 20 * 60 * 1000;

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
  const claves: Record<Periodo, string> = { dia: hoy, semana: claveSemana(hoy), mes: claveMes(hoy) };

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
  const resumen = armarResumen(entrada);
  const seguimiento = armarSeguimiento(entrada);
  let generada: { respuesta: RespuestaModelo; descartadas: Periodo[] };
  try {
    generada = await generar(apiKey, aGenerar, resumen, entrada.memoria, seguimiento);
  } catch (e) {
    const mensaje = describirError(e);
    console.error('[recomendaciones] generar:', mensaje);
    for (const p of aGenerar) tarjetas[p] = { estado: 'error', mensaje: 'No pudimos armar tus recomendaciones ahora. Probá más tarde.' };
    res.status(200).json(tarjetas);
    return;
  }

  // ── 6. Guardar y devolver ──────────────────────────────────────────────
  // Se guardan TODOS los períodos generados, incluidos los que quedaron sin
  // recomendación (contenido null): si no, la próxima vez que se abre Home se
  // volvería a llamar al modelo para ese período.
  const nuevas = aGenerar.map((p) => ({ p, r: generada.respuesta[p] }));

  if (nuevas.length > 0) {
    // "Insertar si no existe" y nunca "insertar o actualizar": desde el
    // navegador sólo se puede cambiar `util` (migración 0029), y la función
    // escribe con la sesión de la persona. Si dos dispositivos generan a la
    // vez, el segundo no pisa al primero: se queda con la que ya estaba.
    const { error } = await supabase.from('recommendations').upsert(
      nuevas.map(({ p, r }) => ({
        user_id: uid, periodo: p, clave: claves[p], contenido: r,
        foco_tipo: r?.foco.tipo ?? null, foco_ref: r?.foco.sobre ?? null, modelo: MODELO,
      })),
      { onConflict: 'user_id,periodo,clave', ignoreDuplicates: true },
    );
    if (error) console.error('[recomendaciones] guardar:', error.message);
  }

  await supabase.from('recommendation_memory').upsert(
    { user_id: uid, observaciones: generada.respuesta.observaciones.slice(0, 8), updated_at: new Date().toISOString() },
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

async function generar(
  apiKey: string, periodos: Periodo[], resumen: unknown, memoria: Observacion[], seguimiento: unknown,
): Promise<{ respuesta: RespuestaModelo; descartadas: Periodo[] }> {
  // Sin reintentos automáticos y con un tiempo máximo por debajo del límite de
  // la función (60 s en vercel.json): si Vercel corta la función primero, la
  // persona recibe un error genérico en vez del mensaje amable.
  const client = new Anthropic({ apiKey, timeout: 55_000, maxRetries: 0 });

  let respuesta = await pedir(client, periodos, resumen, memoria, seguimiento);
  let problemas = revisar(respuesta, periodos);

  // Un reintento si algo no pasó el control de tono, diciéndole qué usó.
  if (problemas.length > 0) {
    const correcciones = [...new Set(problemas.map((x) => `"${x.problema.fragmento}" (${x.problema.porque})`))];
    respuesta = await pedir(client, periodos, resumen, memoria, seguimiento, correcciones);
    problemas = revisar(respuesta, periodos);
  }

  // Lo que sigue sin pasar, no se muestra. Mejor sin recomendación que una que
  // reta a la persona o se parece a un consejo de inversión.
  const descartadas = [...new Set(problemas.map((x) => x.periodo))];
  for (const p of descartadas) {
    console.error('[recomendaciones] descartada por tono:', p, problemas.filter((x) => x.periodo === p).map((x) => x.problema));
    respuesta = { ...respuesta, [p]: null };
  }
  return { respuesta, descartadas };
}

async function pedir(
  client: Anthropic, periodos: Periodo[], resumen: unknown, memoria: Observacion[], seguimiento: unknown, correcciones?: string[],
): Promise<RespuestaModelo> {
  const mensaje = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    // Si el modelo declina por política, el servidor reintenta en el modelo
    // de respaldo que corresponda en vez de devolver el rechazo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: betaZodOutputFormat(Respuesta) },
    // El prompt de sistema es fijo, así que se cachea: las generaciones de
    // todas las personas comparten ese prefijo.
    system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: armarMensaje({ periodos, resumen, memoria, seguimiento, correcciones }) }],
  });

  if (mensaje.stop_reason === 'refusal') throw new Error('El modelo declinó la solicitud');
  if (mensaje.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por largo');
  if (!mensaje.parsed_output) throw new Error('La respuesta no tuvo el formato esperado');
  return normalizar(mensaje.parsed_output);
}

function revisar(r: RespuestaModelo, periodos: Periodo[]): { periodo: Periodo; problema: Problema }[] {
  return periodos.flatMap((p) => {
    const rec = r[p];
    return rec ? revisarRecomendacion(rec).map((problema) => ({ periodo: p, problema })) : [];
  });
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
    .in('clave', Object.values(claves));
  if (error) return { filas: [], error: error.message };
  return { filas: (data ?? []) as Guardada[], error: null };
}

async function leerEntrada(supabase: Cliente, uid: string, ahora: number): Promise<(Entrada & { ultimoIntento: string | null }) | { error: string }> {
  const hoy = diaAR(ahora);
  const hace90 = `${sumarDias(hoy, -90)}T00:00:00-03:00`;
  const hace30 = `${sumarDias(hoy, -30)}T00:00:00-03:00`;

  const [gastos, secciones, medios, objetivos, perfil, inversor, aportes, racha, memoria, historial] = await Promise.all([
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
    supabase.from('recommendations').select('periodo, clave, contenido, foco_tipo, foco_ref, util, created_at')
      .order('created_at', { ascending: false }).limit(10),
  ]);

  const error = [gastos, secciones, medios, objetivos, perfil, inversor, aportes, memoria, historial].find((r) => r.error)?.error;
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
  };
}

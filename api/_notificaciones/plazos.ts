// Aviso de plazo de un objetivo (DEBT I7): "Quedan 30 días para el viaje y
// todavía no apartaste nada", con la salida en rango. Función pura: no lee la
// base ni manda nada. Recibe los objetivos de UNA persona y el día de hoy, y
// devuelve como mucho un aviso, o null.
//
// Cuándo avisa: el objetivo tiene monto y una fecha que se entiende (ver
// `parsearHorizonte` en src/app/utils/goalStrategies.ts), falta plata, y o no
// sumó nada en las últimas 4 semanas o a su ritmo no llega. Y sólo cerca de
// tres hitos: 90, 30 y 7 días antes (cada hito es una ventana de 7 días, así un
// turno que no corrió no hace perder el aviso). Si hay varios, el más cercano.
// Un objetivo en dólares con aportes en pesos y sin dólar para convertir no se
// avisa: con el progreso incompleto el aviso podría ser falso.
//
// ── Cómo engancharlo en api/notificaciones.ts ─────────────────────────────
//
// 1. Importar:
//      import { avisoDePlazo, type ObjetivoConAportes } from './_notificaciones/plazos.js';
//    y sumar 'plazo' al tipo `Tipo`.
//
// 2. En `avisoDeLaManana`, entre el bloque de `vencimiento` y el de `separar`
//    (un pago que vence sigue primero; el plazo de un objetivo va antes que el
//    día de cobro porque tiene fecha), usando la preferencia de "separar", que
//    es la de los avisos de objetivos:
//
//      if (pref.separar !== false) {
//        const aviso = await armarPlazo(supabase, uid, hoy);
//        if (aviso) return { tipo: 'plazo', aviso };
//      }
//
// 3. Y la función que lee la base:
//
//      async function armarPlazo(supabase: SupabaseClient, uid: string, hoy: string): Promise<Aviso | null> {
//        // Una vez por semana por persona (y por lo tanto por objetivo): si en
//        // los últimos 7 días ya salió un aviso de plazo, no se manda otro.
//        const { data: log } = await supabase.from('notification_log')
//          .select('dia').eq('user_id', uid).eq('tipo', 'plazo')
//          .gte('dia', sumarDias(hoy, -6)).limit(1);
//        if (log && log.length > 0) return null;
//        const { data, error } = await supabase.from('goals')
//          .select('id, title, currency, amount_ars, horizon_label, status, goal_contributions(amount, currency, amount_ars, occurred_at)')
//          .eq('user_id', uid).eq('status', 'active');
//        if (error || !data) return null;
//        const { data: cot } = await supabase.from('exchange_rates')
//          .select('rate').eq('currency', 'USD_BLUE').order('fetched_at', { ascending: false }).limit(1).maybeSingle();
//        const dolar = cot ? Number((cot as { rate: number }).rate) : null;
//        return avisoDePlazo(data as ObjetivoConAportes[], hoy, { dolar });
//      }
//
//    (Es la misma lectura que hace api/dolar.ts. Si no se quiere leer el
//    dólar, pasar `dolar: null`: los objetivos en dólares con aportes en pesos
//    simplemente no se avisan.)
//
// 4. El registro en `notification_log` lo hace el handler como con los otros
//    tipos de la mañana (`tipoLog = elegido.tipo`, o sea 'plazo', con
//    `upsert ... ignoreDuplicates` por (user_id, tipo, dia)). Para eso la
//    migración 0041 suma 'plazo' al check de `notification_log.tipo`. Antes de
//    correrla, ese upsert falla, `anotado` viene vacío y el aviso se saltea:
//    no se manda nada y no se rompe nada.
//
// Copy: sin emojis, sin comillas rizadas, sin "deberías". Recuerda, no reta.

import {
  aporteDeLaSemana, diasEntre, fechaLarga, parsearHorizonte, quedan, ritmoSemanal, situacionPlazo,
  type AporteEnMoneda,
} from '../../src/app/utils/goalStrategies.js';

export type ObjetivoConAportes = {
  id: string;
  title: string;
  currency: string;
  amount_ars: number | null;
  horizon_label: string | null;
  status: string;
  goal_contributions: { amount: number; currency: string; amount_ars: number | null; occurred_at: string }[] | null;
};

export type AvisoPlazo = { title: string; body: string; url: string; tag: string };

const HITOS = [7, 30, 90];

const monto = (n: number, moneda: string) =>
  `${moneda === 'USD' ? 'US$' : '$'}${Math.round(n).toLocaleString('es-AR')}`;

/** Los aportes en la moneda del objetivo, o null si alguno no se puede convertir. */
function aportesEnMoneda(o: ObjetivoConAportes, dolar: number | null): AporteEnMoneda[] | null {
  const destino = o.currency === 'USD' ? 'USD' : 'ARS';
  const out: AporteEnMoneda[] = [];
  for (const c of o.goal_contributions ?? []) {
    const origen = c.currency === 'USD' ? 'USD' : 'ARS';
    let v: number | null;
    if (origen === destino) v = Number(c.amount);
    else if (destino === 'ARS') v = c.amount_ars != null ? Number(c.amount_ars) : null;
    else v = dolar ? Number(c.amount) / dolar : null;
    if (v === null || !Number.isFinite(v)) return null;
    out.push({ monto: v, ts: Date.parse(c.occurred_at) });
  }
  return out;
}

/** Qué hito está cruzando: 90, 30 o 7, o null si no está cerca de ninguno. */
function hitoDe(dias: number): number | null {
  for (const h of HITOS) if (dias <= h && dias > h - 7) return h;
  return null;
}

/**
 * @param objetivos los de una persona, con sus aportes (la query del header).
 * @param hoy 'YYYY-MM-DD' en Argentina (`diaAR` de _recomendaciones/fechas).
 * @param opciones.dolar pesos por dólar, para objetivos en USD con aportes en pesos.
 * @param opciones.ahora para tests; por defecto, el mediodía de `hoy` en Argentina.
 */
export function avisoDePlazo(
  objetivos: ObjetivoConAportes[],
  hoy: string,
  opciones: { dolar?: number | null; ahora?: number } = {},
): AvisoPlazo | null {
  const ahora = opciones.ahora ?? Date.parse(`${hoy}T12:00:00-03:00`);
  const candidatos: { dias: number; aviso: AvisoPlazo }[] = [];

  for (const o of objetivos) {
    if (o.status !== 'active') continue;
    const total = o.amount_ars == null ? 0 : Number(o.amount_ars);
    if (!(total > 0)) continue;
    const fecha = parsearHorizonte(o.horizon_label, hoy);
    if (!fecha) continue;
    const dias = diasEntre(hoy, fecha);
    if (dias < 0 || hitoDe(dias) === null) continue;

    const aportes = aportesEnMoneda(o, opciones.dolar ?? null);
    if (!aportes) continue;
    const juntado = aportes.reduce((s, a) => s + a.monto, 0);
    const restante = total - juntado;
    if (restante <= 0) continue;

    const ritmo = ritmoSemanal(aportes, ahora);
    const s = situacionPlazo({ horizonte: o.horizon_label, restante, montoTotal: total, ritmo, hoy });
    if (s.tipo !== 'sin-aportes' && s.tipo !== 'no-llega') continue;

    const nombre = o.title.trim();
    const rango = `entre ${monto(s.porSemana.min, o.currency)} y ${monto(s.porSemana.max, o.currency)}`;
    // Si sumó algo esta semana, se reconoce antes de hablar del plazo.
    const semana = aporteDeLaSemana(aportes, ahora);
    const body = s.tipo === 'sin-aportes'
      ? `Todavía no apartaste nada. Si apartás ${rango} por semana, llegás para el ${fechaLarga(fecha)}.`
      : `${semana > 0 ? `Esta semana apartaste ${monto(semana, o.currency)}. ` : ''}A este ritmo no llegás para el ${fechaLarga(fecha)}. Si apartás ${rango} por semana, llegás.`;

    candidatos.push({
      dias,
      aviso: {
        title: `${quedan(dias)} para ${nombre}`.slice(0, 80),
        // Sin el prefijo de la semana si no entra: mejor sin el dato extra que cortado.
        body: body.length <= 180 ? body : body.replace(/^Esta semana apartaste [^.]*\. /, '').slice(0, 180),
        url: `/onboarding-v2/objetivos?abrir=aporte_objetivo&objetivo=${encodeURIComponent(o.id)}`,
        tag: 'fina-plazo',
      },
    });
  }

  if (candidatos.length === 0) return null;
  return candidatos.sort((a, b) => a.dias - b.dias)[0].aviso;
}

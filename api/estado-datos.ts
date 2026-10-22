// Vercel Serverless Function: el estado de salud de los datos de inversiones, para
// quien mantiene FINA. Arma el paquete de mercado desde cero (sin caché), corre
// todos los chequeos y devuelve qué fuentes respondieron, cuán fresco está cada
// dato y qué alertas hubo en los últimos días.
//
// Está protegido con el mismo secreto que las tareas programadas (CRON_SECRET):
// se llama con el encabezado `Authorization: Bearer <CRON_SECRET>` o con
// `?clave=<CRON_SECRET>` para poder abrirlo desde el navegador.

import { createClient } from '@supabase/supabase-js';
import { edadEnDias } from '../src/app/lib/inversiones/mercadoTipos.js';
import { construirMercado } from './_mercado/fuentes.js';

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(nombre: string, valor: string): void };

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  const secreto = process.env.CRON_SECRET;
  const clave = Array.isArray(req.query?.clave) ? req.query?.clave[0] : req.query?.clave;
  if (!secreto || (req.headers.authorization !== `Bearer ${secreto}` && clave !== secreto)) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const m = await construirMercado();
  const fuentes = [
    { dato: 'Inflación (INDEC, vía ArgentinaDatos)', fecha: m.inflacion.meses[m.inflacion.meses.length - 1]?.fecha ?? null },
    { dato: 'Inflación esperada (REM, BCRA)', fecha: m.inflacion.esperada12m?.fecha ?? null },
    { dato: 'UVA', fecha: m.inflacion.uva30d?.fecha ?? null },
    { dato: 'TAMAR (BCRA)', fecha: m.tasas.tamar?.fecha ?? null },
    { dato: 'Plazos fijos por banco', fecha: m.plazoFijo?.fecha ?? null },
    { dato: 'Cuentas remuneradas', fecha: m.cuentas?.fecha ?? null },
    { dato: 'Fondos comunes (CAFCI)', fecha: m.fondos?.fecha ?? null },
    { dato: 'Dólar', fecha: m.dolar.oficial?.fecha ?? null },
    { dato: 'CEDEARs', fecha: m.cedears?.fecha ?? null, fuente: m.cedears?.fuente ?? null },
    { dato: 'S&P 500', fecha: m.spy?.fecha ?? null },
    { dato: 'Índices del INDEC por rubro', fecha: m.ipc?.fecha ?? null },
  ].map((f) => ({ ...f, edadDias: f.fecha ? edadEnDias(f.fecha) : null }));

  let recientes: unknown[] = [];
  const url = process.env.VITE_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && servicio) {
    try {
      const db = createClient(url, servicio, { auth: { persistSession: false } });
      const { data } = await db.from('data_alerts').select('day, key, severity, message').order('day', { ascending: false }).limit(40);
      recientes = data ?? [];
    } catch {
      /* sin la migración 0040 no hay historial */
    }
  }

  res.status(200).json({
    generadoEn: m.generadoEn,
    estado: m.alertas.some((a) => a.gravedad === 'grave') ? 'grave' : m.alertas.length > 0 ? 'para-revisar' : 'todo-bien',
    fallas: m.fallas,
    alertasAhora: m.alertas,
    fuentes,
    alertasRecientes: recientes,
  });
}

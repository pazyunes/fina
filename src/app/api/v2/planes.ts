import { idUsuaria, supabase } from './cliente';

// El avance de cada paso a paso: qué pasos ya marcó la persona y con qué monto
// empezó. Va a `investment_plans` (migración 0039) para que no se pierda al
// cambiar de teléfono; y SIEMPRE se guarda también en el dispositivo, porque
// sin la migración corrida la tabla no existe y el paso a paso tiene que
// seguir funcionando igual.

export type PlanGuia = {
  producto: string;
  proveedor: string;
  monto: number | null;
  /** Índices (desde 0) de los pasos que ya marcó como hechos. */
  hechos: number[];
  /**
   * Lo demás que eligió al empezar (banco, plazo, ticker, cantidad…). Vive sólo
   * en el dispositivo: la tabla de la base guarda monto y pasos, nada más.
   */
  extra?: Record<string, string>;
};

const clave = (producto: string, proveedor: string) => `fina_inv_plan_${producto}_${proveedor}`;

function leerLocal(producto: string, proveedor: string): PlanGuia | null {
  try {
    const crudo = localStorage.getItem(clave(producto, proveedor));
    if (!crudo) return null;
    const j: unknown = JSON.parse(crudo);
    if (typeof j !== 'object' || j === null) return null;
    const o = j as Record<string, unknown>;
    if (!Array.isArray(o.hechos)) return null;
    const extra: Record<string, string> = {};
    if (typeof o.extra === 'object' && o.extra !== null) {
      for (const [k, v] of Object.entries(o.extra as Record<string, unknown>)) if (typeof v === 'string') extra[k] = v;
    }
    return {
      producto,
      proveedor,
      monto: typeof o.monto === 'number' ? o.monto : null,
      hechos: o.hechos.filter((x): x is number => typeof x === 'number'),
      extra,
    };
  } catch {
    return null;
  }
}

const PREFIJO = 'fina_inv_plan_';

function escribirLocal(plan: PlanGuia) {
  try {
    localStorage.setItem(clave(plan.producto, plan.proveedor), JSON.stringify({ producto: plan.producto, proveedor: plan.proveedor, monto: plan.monto, hechos: plan.hechos, extra: plan.extra ?? {}, ts: Date.now() }));
  } catch {
    /* el almacenamiento puede estar bloqueado: el avance vive igual en pantalla */
  }
}

/** Lo que la persona ya había avanzado en este paso a paso, o null si todavía no empezó. */
export async function leerPlan(producto: string, proveedor: string): Promise<PlanGuia | null> {
  const local = leerLocal(producto, proveedor);
  try {
    const uid = await idUsuaria();
    if (!uid) return local;
    const { data, error } = await supabase
      .from('investment_plans')
      .select('amount, done_steps')
      .eq('product', producto)
      .eq('provider', proveedor)
      .maybeSingle();
    if (error || !data) return local;
    const plan: PlanGuia = {
      producto,
      proveedor,
      monto: data.amount === null ? null : Number(data.amount),
      hechos: Array.isArray(data.done_steps) ? data.done_steps.map(Number) : [],
      extra: local?.extra ?? {},
    };
    escribirLocal(plan);
    return plan;
  } catch {
    return local;
  }
}

export async function guardarPlan(plan: PlanGuia): Promise<void> {
  escribirLocal(plan);
  try {
    const uid = await idUsuaria();
    if (!uid) return;
    await supabase.from('investment_plans').upsert(
      {
        user_id: uid,
        product: plan.producto,
        provider: plan.proveedor,
        amount: plan.monto,
        done_steps: plan.hechos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,product,provider' },
    );
  } catch {
    /* sin la migración, o sin red: ya quedó en el dispositivo */
  }
}

/**
 * Todos los paso a paso que la persona dejó a la mitad (con al menos un paso hecho), el más reciente primero. Los
 * que se guardaron antes de que el plan llevara su producto adentro se leen igual, por el nombre de la clave.
 */
export async function listarPlanes(): Promise<PlanGuia[]> {
  const salida: (PlanGuia & { ts: number })[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIJO)) continue;
      const crudo = localStorage.getItem(k);
      if (!crudo) continue;
      const j: unknown = JSON.parse(crudo);
      if (typeof j !== 'object' || j === null) continue;
      const o = j as Record<string, unknown>;
      const resto = k.slice(PREFIJO.length);
      const producto = typeof o.producto === 'string' ? o.producto : PRODUCTOS_CONOCIDOS.find((p) => resto.startsWith(`${p}_`));
      if (!producto) continue;
      const proveedor = typeof o.proveedor === 'string' ? o.proveedor : resto.slice(producto.length + 1);
      const plan = leerLocal(producto, proveedor);
      if (plan && plan.hechos.length > 0) salida.push({ ...plan, ts: typeof o.ts === 'number' ? o.ts : 0 });
    }
  } catch {
    /* sin almacenamiento local no hay pendientes que listar */
  }
  return salida.sort((a, b) => b.ts - a.ts).map(({ ts: _ts, ...plan }) => plan);
}

const PRODUCTOS_CONOCIDOS = ['cuenta_remunerada', 'plazo_fijo_uva', 'plazo_fijo', 'bono_cer', 'fci', 'letra', 'dolar', 'cedear'];

/** Borra el avance de un paso a paso: lo cancela la persona o ya lo terminó (lo anotó). */
export async function borrarPlan(producto: string, proveedor: string): Promise<void> {
  try { localStorage.removeItem(clave(producto, proveedor)); } catch { /* nada que borrar */ }
  try {
    const uid = await idUsuaria();
    if (!uid) return;
    await supabase.from('investment_plans').delete().eq('user_id', uid).eq('product', producto).eq('provider', proveedor);
  } catch {
    /* sin la migración, o sin red: ya quedó borrado en el dispositivo */
  }
}

/** Borra todos los avances de un producto (cuando la persona termina, o cuando cancela). */
export async function borrarPlanesDe(producto: string): Promise<void> {
  const todos = await listarPlanes();
  await Promise.all(todos.filter((p) => p.producto === producto).map((p) => borrarPlan(p.producto, p.proveedor)));
}

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
    return {
      producto,
      proveedor,
      monto: typeof o.monto === 'number' ? o.monto : null,
      hechos: o.hechos.filter((x): x is number => typeof x === 'number'),
    };
  } catch {
    return null;
  }
}

function escribirLocal(plan: PlanGuia) {
  try {
    localStorage.setItem(clave(plan.producto, plan.proveedor), JSON.stringify({ monto: plan.monto, hechos: plan.hechos }));
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

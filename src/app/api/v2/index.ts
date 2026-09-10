import { correr, falla, idUsuaria, ok, slugify, supabase, type Resultado } from './cliente';
import {
  ESTADO_VACIO, PERFIL_VACIO,
  type AporteInversion, type Contribucion, type EstadoV2, type Gasto, type Grupo,
  type MedioPago, type MiembroGrupo, type Moneda, type Objetivo, type Perfil,
  type PerfilInversor, type Periodo, type Seccion, type TipoGasto,
} from './tipos';

export * from './tipos';
export type { Resultado } from './cliente';

// ─────────────────────────────────────────────────────────────────────────
// API del flujo v2 contra Supabase.
//
// Una función por operación. Los componentes llaman a esto y nunca a
// `supabase` directo (regla 6). Todo devuelve `Resultado<T>` para que la UI
// pueda avisar cuando algo no se guardó: un guardado que falla en silencio es
// peor que uno que falla, porque la persona sigue confiando en un número que
// no existe.
// ─────────────────────────────────────────────────────────────────────────

// ── Carga inicial ────────────────────────────────────────────────────────
// Todo lo de una usuaria en una sola tanda. Las queries van en paralelo: son
// independientes entre sí y en serie sumarían la latencia de cada una.
export async function cargarTodo(): Promise<Resultado<EstadoV2>> {
  const uid = await idUsuaria();
  if (!uid) return falla<EstadoV2>('sin sesión', 'cargarTodo');

  try {
    const [perfil, secciones, medios, gastos, objetivos, perfInv, aportes, grupo] = await Promise.all([
      leerPerfil(uid),
      listarSecciones(),
      listarMediosPago(),
      listarGastos(),
      listarObjetivos(),
      leerPerfilInversor(),
      listarAportes(),
      leerMiGrupo(),
    ]);

    // Si el perfil falla, no hay nada que mostrar: es la fila raíz.
    if (perfil.error !== null) return falla<EstadoV2>(perfil.error, 'cargarTodo/perfil');

    return ok({
      ...ESTADO_VACIO,
      perfil: perfil.data,
      secciones: secciones.data ?? [],
      mediosPago: medios.data ?? [],
      gastos: gastos.data ?? [],
      objetivos: objetivos.data ?? [],
      perfilInversor: perfInv.data ?? null,
      aportes: aportes.data ?? [],
      grupo: grupo.data ?? null,
    });
  } catch (e) {
    return falla<EstadoV2>(e, 'cargarTodo');
  }
}

// ── Perfil ───────────────────────────────────────────────────────────────
type FilaPerfil = {
  name: string | null; gender: string | null; gender_other: string | null;
  age_range: string | null; zone: string | null; cohabitation: string[] | null;
  income_sources: string[] | null; income_stability: string | null;
  main_goal: string | null; how_found_us: string | null; financial_level: string | null;
  reserve_ars: number | null; phone: string | null; terms_accepted_at: string | null;
  onboarding_v2: Record<string, unknown> | null;
};

function aPerfil(f: FilaPerfil | null): Perfil {
  if (!f) return PERFIL_VACIO;
  return {
    nombre: f.name ?? '',
    genero: f.gender,
    generoOtro: f.gender_other,
    rangoEdad: f.age_range,
    zona: f.zone,
    convivencia: f.cohabitation ?? [],
    ingresos: f.income_sources ?? [],
    estabilidadIngresos: f.income_stability,
    metaPrincipal: f.main_goal,
    comoConocio: f.how_found_us,
    nivelFinanciero: f.financial_level,
    reserva: Number(f.reserve_ars ?? 0),
    telefono: f.phone,
    terminosAceptadosEn: f.terms_accepted_at,
    onboarding: f.onboarding_v2,
  };
}

async function leerPerfil(uid: string): Promise<Resultado<Perfil>> {
  const r = await correr<FilaPerfil>('leerPerfil', () =>
    supabase
      .from('user_profiles')
      .select('name, gender, gender_other, age_range, zone, cohabitation, income_sources, income_stability, main_goal, how_found_us, financial_level, reserve_ars, phone, terms_accepted_at, onboarding_v2')
      .eq('id', uid)
      .maybeSingle(),
  );
  if (r.error !== null) return falla<Perfil>(r.error, 'leerPerfil');
  return ok(aPerfil(r.data));
}

/** Guarda solo los campos que se pasan. La fila la crea el trigger de auth. */
export async function guardarPerfil(p: Partial<Perfil>): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'guardarPerfil');

  const fila: Record<string, unknown> = { id: uid };
  if (p.nombre !== undefined) fila.name = p.nombre;
  if (p.genero !== undefined) fila.gender = p.genero;
  if (p.generoOtro !== undefined) fila.gender_other = p.generoOtro;
  if (p.rangoEdad !== undefined) fila.age_range = p.rangoEdad;
  if (p.zona !== undefined) fila.zone = p.zona;
  if (p.convivencia !== undefined) fila.cohabitation = p.convivencia;
  if (p.ingresos !== undefined) fila.income_sources = p.ingresos;
  if (p.estabilidadIngresos !== undefined) fila.income_stability = p.estabilidadIngresos;
  if (p.metaPrincipal !== undefined) fila.main_goal = p.metaPrincipal;
  if (p.comoConocio !== undefined) fila.how_found_us = p.comoConocio;
  if (p.nivelFinanciero !== undefined) fila.financial_level = p.nivelFinanciero;
  if (p.reserva !== undefined) fila.reserve_ars = p.reserva;
  if (p.telefono !== undefined) fila.phone = p.telefono;
  if (p.terminosAceptadosEn !== undefined) fila.terms_accepted_at = p.terminosAceptadosEn;
  if (p.onboarding !== undefined) fila.onboarding_v2 = p.onboarding;

  return correr<null>('guardarPerfil', () =>
    supabase.from('user_profiles').upsert(fila, { onConflict: 'id' }).select('id').then(
      ({ error }) => ({ data: null, error }),
    ),
  );
}

// ── Secciones ────────────────────────────────────────────────────────────
type FilaSeccion = { id: string; name: string; slug: string; cap_amount: number | null; cap_period: string | null };

export async function listarSecciones(): Promise<Resultado<Seccion[]>> {
  const r = await correr<FilaSeccion[]>('listarSecciones', () =>
    supabase.from('expense_sections').select('id, name, slug, cap_amount, cap_period')
      .eq('archived', false).order('created_at', { ascending: true }),
  );
  if (r.error !== null) return falla<Seccion[]>(r.error, 'listarSecciones');
  return ok((r.data ?? []).map((f) => ({
    id: f.id,
    nombre: f.name,
    slug: f.slug,
    tope: f.cap_amount != null && f.cap_period
      ? { monto: Number(f.cap_amount), periodo: f.cap_period as Periodo }
      : null,
  })));
}

// El `id` se genera en el cliente y se inserta explícito. Así el id local y el
// remoto son el MISMO valor desde el primer render: la interfaz puede pintar la
// fila nueva al instante y la escritura no tiene que volver a decirle qué id le
// tocó. Sin esto haría falta un mapa id-local → id-remoto, que es una segunda
// verdad más para mantener sincronizada.
export async function crearSeccion(nombre: string, id?: string): Promise<Resultado<Seccion>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Seccion>('sin sesión', 'crearSeccion');
  const slug = slugify(nombre);

  // upsert por (user_id, slug): si la sección ya existe no se duplica, y sirve
  // para el caso de elegir una sugerida que ya estaba archivada.
  const r = await correr<FilaSeccion[]>('crearSeccion', () =>
    supabase.from('expense_sections')
      .upsert({ ...(id ? { id } : {}), user_id: uid, name: nombre.trim(), slug, archived: false }, { onConflict: 'user_id,slug' })
      .select('id, name, slug, cap_amount, cap_period'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Seccion>(r.error ?? 'sin fila', 'crearSeccion');
  const f = r.data[0];
  return ok({ id: f.id, nombre: f.name, slug: f.slug, tope: null });
}

/** `null` saca el tope. Monto y período van juntos: un tope sin período no es un tope. */
export async function guardarTope(seccionId: string, tope: { monto: number; periodo: Periodo } | null): Promise<Resultado<null>> {
  return correr<null>('guardarTope', () =>
    supabase.from('expense_sections')
      .update({ cap_amount: tope?.monto ?? null, cap_period: tope?.periodo ?? null })
      .eq('id', seccionId)
      .then(({ error }) => ({ data: null, error })),
  );
}

export async function renombrarSeccion(seccionId: string, nombre: string): Promise<Resultado<null>> {
  return correr<null>('renombrarSeccion', () =>
    supabase.from('expense_sections')
      .update({ name: nombre.trim(), slug: slugify(nombre) })
      .eq('id', seccionId)
      .then(({ error }) => ({ data: null, error })),
  );
}

/**
 * Archiva la sección en vez de borrarla.
 *
 * Los gastos apuntan a ella (`section_id`). Borrar la fila los dejaría sin
 * sección para siempre; archivarla la saca de la lista pero deja que los
 * gastos viejos sigan diciendo a qué sección pertenecían. Si más adelante
 * vuelve a crear una sección con el mismo nombre, `crearSeccion` la
 * desarchiva (upsert por user_id+slug) y los gastos vuelven a agruparse.
 */
export async function borrarSeccion(seccionId: string): Promise<Resultado<null>> {
  return correr<null>('borrarSeccion', () =>
    supabase.from('expense_sections')
      .update({ archived: true, cap_amount: null, cap_period: null })
      .eq('id', seccionId)
      .then(({ error }) => ({ data: null, error })),
  );
}

// ── Medios de pago y disponible ──────────────────────────────────────────
type FilaMedio = { id: string; name: string; balance_ars: number | null; last_used_at: string | null };

export async function listarMediosPago(): Promise<Resultado<MedioPago[]>> {
  const r = await correr<FilaMedio[]>('listarMediosPago', () =>
    supabase.from('payment_methods').select('id, name, balance_ars, last_used_at')
      .order('last_used_at', { ascending: false, nullsFirst: false }),
  );
  if (r.error !== null) return falla<MedioPago[]>(r.error, 'listarMediosPago');
  return ok((r.data ?? []).map((f) => ({
    id: f.id, nombre: f.name, saldo: Number(f.balance_ars ?? 0), usadoEn: f.last_used_at,
  })));
}

/** Suma plata disponible a un medio. Lo crea si no existía. */
export async function sumarDisponible(medio: string, monto: number): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'sumarDisponible');
  const nombre = medio.trim() || 'Efectivo';

  const actual = await correr<FilaMedio | null>('sumarDisponible/leer', () =>
    supabase.from('payment_methods').select('id, name, balance_ars, last_used_at')
      .eq('user_id', uid).eq('name', nombre).maybeSingle(),
  );
  if (actual.error !== null) return falla<null>(actual.error, 'sumarDisponible');

  const saldo = Number(actual.data?.balance_ars ?? 0) + monto;
  return correr<null>('sumarDisponible/upsert', () =>
    supabase.from('payment_methods')
      .upsert({ user_id: uid, name: nombre, balance_ars: saldo, last_used_at: new Date().toISOString() }, { onConflict: 'user_id,name' })
      .then(({ error }) => ({ data: null, error })),
  );
}

// ── Gastos ───────────────────────────────────────────────────────────────
type FilaGasto = {
  id: string; amount_ars: number; currency: string; original_amount: number | null;
  description: string | null; section_id: string | null; expense_type: string | null;
  payment_method: string | null; group_id: string | null; occurred_at: string; source: string;
};

function aGasto(f: FilaGasto): Gasto {
  const moneda = (f.currency === 'USD' ? 'USD' : 'ARS') as Moneda;
  return {
    id: f.id,
    // En USD el monto que la persona tipeó vive en original_amount; amount_ars
    // es el equivalente congelado a la cotización de ese día.
    monto: moneda === 'USD' ? Number(f.original_amount ?? f.amount_ars) : Number(f.amount_ars),
    moneda,
    descripcion: f.description ?? '',
    seccionId: f.section_id,
    tipo: (f.expense_type ?? 'otro') as TipoGasto,
    metodoPago: f.payment_method,
    grupoId: f.group_id,
    ts: new Date(f.occurred_at).getTime(),
    origen: (f.source === 'whatsapp' ? 'whatsapp' : f.source === 'manual' ? 'manual' : 'web'),
  };
}

export async function listarGastos(): Promise<Resultado<Gasto[]>> {
  const r = await correr<FilaGasto[]>('listarGastos', () =>
    supabase.from('transactions')
      .select('id, amount_ars, currency, original_amount, description, section_id, expense_type, payment_method, group_id, occurred_at, source')
      .eq('type', 'expense')
      .order('occurred_at', { ascending: false })
      .limit(500),
  );
  if (r.error !== null) return falla<Gasto[]>(r.error, 'listarGastos');
  return ok((r.data ?? []).map(aGasto));
}

export async function registrarGasto(g: {
  id?: string;
  monto: number; moneda: Moneda; montoArs: number; cotizacionId?: string | null;
  descripcion: string; seccionId: string | null; tipo: TipoGasto;
  metodoPago: string | null; grupoId?: string | null; ts?: number;
}): Promise<Resultado<Gasto>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Gasto>('sin sesión', 'registrarGasto');

  const r = await correr<FilaGasto[]>('registrarGasto', () =>
    supabase.from('transactions').insert({
      ...(g.id ? { id: g.id } : {}),
      user_id: uid,
      occurred_at: new Date(g.ts ?? Date.now()).toISOString(),
      type: 'expense',
      amount_ars: g.montoArs,
      currency: g.moneda,
      original_amount: g.moneda === 'USD' ? g.monto : null,
      exchange_rate_id: g.cotizacionId ?? null,
      description: g.descripcion,
      section_id: g.seccionId,
      expense_type: g.tipo,
      payment_method: g.metodoPago,
      group_id: g.grupoId ?? null,
      // 'web' = lo cargó la persona en la app. El bot escribe 'whatsapp'.
      source: 'web',
    }).select('id, amount_ars, currency, original_amount, description, section_id, expense_type, payment_method, group_id, occurred_at, source'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Gasto>(r.error ?? 'sin fila', 'registrarGasto');

  // El medio usado sube al principio de la lista para la próxima vez.
  if (g.metodoPago) {
    await correr<null>('registrarGasto/medio', () =>
      supabase.from('payment_methods')
        .upsert({ user_id: uid, name: g.metodoPago, last_used_at: new Date().toISOString() }, { onConflict: 'user_id,name', ignoreDuplicates: false })
        .then(({ error }) => ({ data: null, error })),
    );
  }
  return ok(aGasto(r.data[0]));
}

export async function borrarGasto(id: string): Promise<Resultado<null>> {
  return correr<null>('borrarGasto', () =>
    supabase.from('transactions').delete().eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

// ── Objetivos ────────────────────────────────────────────────────────────
type FilaObjetivo = {
  id: string; title: string; description: string | null; amount_ars: number | null;
  currency: string; horizon_label: string | null; kind: string; status: string;
  goal_contributions: { id: string; amount: number; currency: string; amount_ars: number; kind: string; label: string | null; occurred_at: string }[] | null;
};

export async function listarObjetivos(): Promise<Resultado<Objetivo[]>> {
  const r = await correr<FilaObjetivo[]>('listarObjetivos', () =>
    supabase.from('goals')
      .select('id, title, description, amount_ars, currency, horizon_label, kind, status, goal_contributions(id, amount, currency, amount_ars, kind, label, occurred_at)')
      .order('created_at', { ascending: true }),
  );
  if (r.error !== null) return falla<Objetivo[]>(r.error, 'listarObjetivos');
  return ok((r.data ?? []).map((f) => ({
    id: f.id,
    nombre: f.title,
    descripcion: f.description ?? '',
    tipo: (f.kind === 'grupal' ? 'grupal' : 'individual') as Objetivo['tipo'],
    moneda: (f.currency === 'USD' ? 'USD' : 'ARS') as Moneda,
    horizonte: f.horizon_label,
    montoTotal: f.amount_ars == null ? null : Number(f.amount_ars),
    estado: (f.status as Objetivo['estado']) ?? 'active',
    contribuciones: (f.goal_contributions ?? [])
      .map((c): Contribucion => ({
        id: c.id,
        monto: Number(c.amount),
        moneda: (c.currency === 'USD' ? 'USD' : 'ARS') as Moneda,
        montoArs: Number(c.amount_ars),
        kind: c.kind === 'paid' ? 'paid' : 'saved',
        label: c.label,
        ts: new Date(c.occurred_at).getTime(),
      }))
      .sort((a, b) => b.ts - a.ts),
  })));
}

export async function crearObjetivo(o: {
  id?: string;
  nombre: string; descripcion?: string; tipo?: 'individual' | 'grupal';
  moneda?: Moneda; horizonte?: string | null; montoTotal: number | null;
}): Promise<Resultado<Objetivo>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Objetivo>('sin sesión', 'crearObjetivo');

  const r = await correr<{ id: string }[]>('crearObjetivo', () =>
    supabase.from('goals').insert({
      ...(o.id ? { id: o.id } : {}),
      user_id: uid,
      title: o.nombre.trim(),
      description: o.descripcion?.trim() || null,
      amount_ars: o.montoTotal,
      currency: o.moneda ?? 'ARS',
      horizon_label: o.horizonte ?? null,
      kind: o.tipo ?? 'individual',
      status: 'active',
    }).select('id'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Objetivo>(r.error ?? 'sin fila', 'crearObjetivo');
  return ok({
    id: r.data[0].id,
    nombre: o.nombre.trim(),
    descripcion: o.descripcion?.trim() ?? '',
    tipo: o.tipo ?? 'individual',
    moneda: o.moneda ?? 'ARS',
    horizonte: o.horizonte ?? null,
    montoTotal: o.montoTotal,
    estado: 'active',
    contribuciones: [],
  });
}

export async function editarObjetivo(id: string, o: Partial<Pick<Objetivo, 'nombre' | 'descripcion' | 'tipo' | 'moneda' | 'horizonte' | 'montoTotal' | 'estado'>>): Promise<Resultado<null>> {
  const fila: Record<string, unknown> = {};
  if (o.nombre !== undefined) fila.title = o.nombre;
  if (o.descripcion !== undefined) fila.description = o.descripcion || null;
  if (o.tipo !== undefined) fila.kind = o.tipo;
  if (o.moneda !== undefined) fila.currency = o.moneda;
  if (o.horizonte !== undefined) fila.horizon_label = o.horizonte;
  if (o.montoTotal !== undefined) fila.amount_ars = o.montoTotal;
  if (o.estado !== undefined) fila.status = o.estado;
  if (Object.keys(fila).length === 0) return ok(null);

  return correr<null>('editarObjetivo', () =>
    supabase.from('goals').update(fila).eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

export async function borrarObjetivo(id: string): Promise<Resultado<null>> {
  return correr<null>('borrarObjetivo', () =>
    supabase.from('goals').delete().eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

export async function sumarContribucion(objetivoId: string, c: {
  id?: string;
  monto: number; moneda: Moneda; montoArs: number; cotizacionId?: string | null;
  kind: 'paid' | 'saved'; label?: string | null; ts?: number;
}): Promise<Resultado<Contribucion>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Contribucion>('sin sesión', 'sumarContribucion');

  const r = await correr<{ id: string }[]>('sumarContribucion', () =>
    supabase.from('goal_contributions').insert({
      ...(c.id ? { id: c.id } : {}),
      goal_id: objetivoId,
      user_id: uid,
      amount: c.monto,
      currency: c.moneda,
      exchange_rate_id: c.cotizacionId ?? null,
      amount_ars: c.montoArs,
      kind: c.kind,
      label: c.label ?? null,
      occurred_at: new Date(c.ts ?? Date.now()).toISOString(),
    }).select('id'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Contribucion>(r.error ?? 'sin fila', 'sumarContribucion');
  return ok({
    id: r.data[0].id, monto: c.monto, moneda: c.moneda, montoArs: c.montoArs,
    kind: c.kind, label: c.label ?? null, ts: c.ts ?? Date.now(),
  });
}

export async function borrarContribucion(id: string): Promise<Resultado<null>> {
  return correr<null>('borrarContribucion', () =>
    supabase.from('goal_contributions').delete().eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

// ── Inversiones ──────────────────────────────────────────────────────────
export async function leerPerfilInversor(): Promise<Resultado<PerfilInversor | null>> {
  const r = await correr<{ horizon: string | null; reaction: string | null; already_invests: boolean | null; invests_in: string[] | null; wallets: string[] | null } | null>(
    'leerPerfilInversor',
    () => supabase.from('investment_profiles').select('horizon, reaction, already_invests, invests_in, wallets').maybeSingle(),
  );
  if (r.error !== null) return falla<PerfilInversor | null>(r.error, 'leerPerfilInversor');
  if (!r.data) return ok(null);
  return ok({
    porQue: r.data.horizon,
    reaccion: r.data.reaction,
    yaInvierte: r.data.already_invests,
    enQue: r.data.invests_in ?? [],
    bancos: r.data.wallets ?? [],
  });
}

export async function guardarPerfilInversor(p: PerfilInversor): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'guardarPerfilInversor');
  return correr<null>('guardarPerfilInversor', () =>
    supabase.from('investment_profiles').upsert({
      user_id: uid,
      horizon: p.porQue,
      reaction: p.reaccion,
      already_invests: p.yaInvierte,
      invests_in: p.enQue,
      wallets: p.bancos,
    }, { onConflict: 'user_id' }).then(({ error }) => ({ data: null, error })),
  );
}

export async function listarAportes(): Promise<Resultado<AporteInversion[]>> {
  const r = await correr<{ id: string; instrument: string; amount: number; currency: string; amount_ars: number; exchange_rate_id: string | null; occurred_at: string }[]>(
    'listarAportes',
    () => supabase.from('investment_contributions')
      .select('id, instrument, amount, currency, amount_ars, exchange_rate_id, occurred_at')
      .order('occurred_at', { ascending: false }),
  );
  if (r.error !== null) return falla<AporteInversion[]>(r.error, 'listarAportes');
  return ok((r.data ?? []).map((f) => ({
    id: f.id,
    instrumento: f.instrument,
    monto: Number(f.amount),
    moneda: (f.currency === 'USD' ? 'USD' : 'ARS') as Moneda,
    montoArs: Number(f.amount_ars),
    cotizacion: null,
    ts: new Date(f.occurred_at).getTime(),
  })));
}

export async function sumarAporte(a: {
  id?: string;
  instrumento: string; monto: number; moneda: Moneda; montoArs: number; cotizacionId?: string | null; ts?: number;
}): Promise<Resultado<AporteInversion>> {
  const uid = await idUsuaria();
  if (!uid) return falla<AporteInversion>('sin sesión', 'sumarAporte');

  const r = await correr<{ id: string }[]>('sumarAporte', () =>
    supabase.from('investment_contributions').insert({
      ...(a.id ? { id: a.id } : {}),
      user_id: uid,
      instrument: a.instrumento,
      amount: a.monto,
      currency: a.moneda,
      exchange_rate_id: a.cotizacionId ?? null,
      amount_ars: a.montoArs,
      occurred_at: new Date(a.ts ?? Date.now()).toISOString(),
    }).select('id'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<AporteInversion>(r.error ?? 'sin fila', 'sumarAporte');
  return ok({
    id: r.data[0].id, instrumento: a.instrumento, monto: a.monto, moneda: a.moneda,
    montoArs: a.montoArs, cotizacion: null, ts: a.ts ?? Date.now(),
  });
}

export async function editarAporte(id: string, a: { instrumento?: string; monto?: number; moneda?: Moneda; montoArs?: number; cotizacionId?: string | null }): Promise<Resultado<null>> {
  const fila: Record<string, unknown> = {};
  if (a.instrumento !== undefined) fila.instrument = a.instrumento;
  if (a.monto !== undefined) fila.amount = a.monto;
  if (a.moneda !== undefined) fila.currency = a.moneda;
  if (a.montoArs !== undefined) fila.amount_ars = a.montoArs;
  if (a.cotizacionId !== undefined) fila.exchange_rate_id = a.cotizacionId;
  if (Object.keys(fila).length === 0) return ok(null);
  return correr<null>('editarAporte', () =>
    supabase.from('investment_contributions').update(fila).eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

export async function borrarAporte(id: string): Promise<Resultado<null>> {
  return correr<null>('borrarAporte', () =>
    supabase.from('investment_contributions').delete().eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

// ── Grupos ───────────────────────────────────────────────────────────────
// Acá el modelo de acceso es distinto al resto: las policies dejan que una
// miembro lea filas de las demás, pero SOLO dentro del grupo. Ver la migración
// 0022 para el detalle.
export async function leerMiGrupo(): Promise<Resultado<Grupo | null>> {
  const uid = await idUsuaria();
  if (!uid) return ok(null);

  const mio = await correr<{ group_id: string }[]>('leerMiGrupo/membresia', () =>
    supabase.from('group_members').select('group_id').eq('user_id', uid).limit(1),
  );
  if (mio.error !== null) return falla<Grupo | null>(mio.error, 'leerMiGrupo');
  const gid = mio.data?.[0]?.group_id;
  if (!gid) return ok(null);

  const g = await correr<{ id: string; name: string; code: string } | null>('leerMiGrupo/grupo', () =>
    supabase.from('groups').select('id, name, code').eq('id', gid).maybeSingle(),
  );
  if (g.error !== null || !g.data) return falla<Grupo | null>(g.error ?? 'grupo no visible', 'leerMiGrupo');

  const m = await correr<{ user_id: string; role: string; activity: number }[]>('leerMiGrupo/miembros', () =>
    supabase.from('group_members').select('user_id, role, activity')
      .eq('group_id', gid).order('activity', { ascending: false }),
  );
  if (m.error !== null) return falla<Grupo | null>(m.error, 'leerMiGrupo');

  // Los nombres de las demás miembras vienen de la vista `group_member_names`,
  // que expone SOLO el nombre de quienes comparten grupo con vos (ver 0024).
  const nombres = await correr<{ user_id: string; name: string | null }[]>('leerMiGrupo/nombres', () =>
    supabase.from('group_member_names').select('user_id, name').eq('group_id', gid),
  );
  const porId = new Map((nombres.data ?? []).map((n) => [n.user_id, n.name ?? 'Alguien']));

  const miembros: MiembroGrupo[] = (m.data ?? []).map((x) => ({
    userId: x.user_id,
    nombre: porId.get(x.user_id) ?? 'Alguien',
    actividad: x.activity,
    rol: x.role === 'owner' ? 'owner' : 'member',
    sosVos: x.user_id === uid,
  }));

  return ok({ id: g.data.id, nombre: g.data.name, codigo: g.data.code, miembros });
}

function codigoAlAzar(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1: se confunden al dictarlo
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `FINA-${s}`;
}

export async function crearGrupo(nombre: string): Promise<Resultado<Grupo>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Grupo>('sin sesión', 'crearGrupo');

  // Reintenta si el código sale repetido: hay un unique en la columna.
  for (let intento = 0; intento < 5; intento++) {
    const code = codigoAlAzar();
    const r = await correr<{ id: string; name: string; code: string }[]>('crearGrupo', () =>
      supabase.from('groups').insert({ name: nombre.trim(), code, created_by: uid }).select('id, name, code'),
    );
    if (r.data?.[0]) {
      const g = r.data[0];
      const m = await correr<null>('crearGrupo/miembro', () =>
        supabase.from('group_members').insert({ group_id: g.id, user_id: uid, role: 'owner' })
          .then(({ error }) => ({ data: null, error })),
      );
      if (m.error !== null) return falla<Grupo>(m.error, 'crearGrupo/miembro');
      return ok({ id: g.id, nombre: g.name, codigo: g.code, miembros: [] });
    }
    if (r.error !== null && !r.error.includes('duplicate')) return falla<Grupo>(r.error, 'crearGrupo');
  }
  return falla<Grupo>('no se pudo generar un código libre', 'crearGrupo');
}

/** Entra a un grupo por código. Devuelve null si el código no existe. */
export async function unirseAGrupo(codigo: string): Promise<Resultado<Grupo | null>> {
  const r = await correr<string | null>('unirseAGrupo', () =>
    supabase.rpc('unirse_a_grupo', { codigo }).then(({ data, error }) => ({ data: data as string | null, error })),
  );
  if (r.error !== null) return falla<Grupo | null>(r.error, 'unirseAGrupo');
  if (!r.data) return ok(null);
  return leerMiGrupo();
}

export async function salirDelGrupo(grupoId: string): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'salirDelGrupo');
  return correr<null>('salirDelGrupo', () =>
    supabase.from('group_members').delete().eq('group_id', grupoId).eq('user_id', uid)
      .then(({ error }) => ({ data: null, error })),
  );
}

/** La actividad con la que se compite es cuánto REGISTRÁS, no cuánto gastás. */
export async function sumarActividad(grupoId: string, delta = 1): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'sumarActividad');
  const actual = await correr<{ activity: number } | null>('sumarActividad/leer', () =>
    supabase.from('group_members').select('activity').eq('group_id', grupoId).eq('user_id', uid).maybeSingle(),
  );
  if (actual.error !== null) return falla<null>(actual.error, 'sumarActividad');
  return correr<null>('sumarActividad', () =>
    supabase.from('group_members').update({ activity: Number(actual.data?.activity ?? 0) + delta })
      .eq('group_id', grupoId).eq('user_id', uid)
      .then(({ error }) => ({ data: null, error })),
  );
}

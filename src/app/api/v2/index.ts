import { correr, falla, idUsuaria, ok, slugify, supabase, type Resultado } from './cliente';
import { cotizacionDolar } from './cotizacion';
import {
  ESTADO_VACIO, PERFIL_VACIO,
  type AporteInversion, type Contribucion, type EstadoV2, type FuenteIngreso, type Gasto, type GastoFijo, type Grupo, type Ingreso,
  type Carga, type MedioPago, type MiembroGrupo, type Moneda, type MonedaConvertible,
  type Objetivo, type PagoMixto, type Perfil,
  type PerfilInversor, type Periodo, type Seccion, type TipoGasto,
  type PasoGuardado, type Racha, RACHA_VACIA,
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
    const [perfil, secciones, medios, gastos, ingresos, cargas, fijos, objetivos, perfInv, aportes, grupo, dolar] = await Promise.all([
      leerPerfil(uid),
      listarSecciones(),
      listarMediosPago(),
      listarGastos(),
      listarIngresos(),
      listarCargas(),
      listarGastosFijos(),
      listarObjetivos(),
      leerPerfilInversor(),
      listarAportes(),
      leerMiGrupo(),
      // Para pasar un registro en pesos a un objetivo en dólares (y al revés).
      cotizacionDolar(),
    ]);

    // Si el perfil falla, no hay nada que mostrar: es la fila raíz.
    if (perfil.error !== null) return falla<EstadoV2>(perfil.error, 'cargarTodo/perfil');

    return ok({
      ...ESTADO_VACIO,
      perfil: perfil.data,
      secciones: secciones.data ?? [],
      mediosPago: medios.data ?? [],
      gastos: gastos.data ?? [],
      // Si la lectura de ingresos falla (por ejemplo, sin la migración 0033),
      // la app carga igual: sólo no se ven los ingresos.
      ingresos: ingresos.data ?? [],
      // Sin la migración 0037 no hay tabla de cargas: la app carga igual.
      cargas: cargas.data ?? [],
      // Sin cotización queda en null: los montos siguen en su moneda y no se
      // inventa una conversión.
      dolar: dolar?.valor ?? null,
      // Igual: sin la migración 0034, la app carga sin gastos fijos.
      gastosFijos: fijos.data ?? [],
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
  onboarding_v2: Record<string, unknown> | null; avatar_path: string | null;
  phone_verified_at: string | null;
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
    fotoUrl: f.avatar_path ? urlDeFoto(f.avatar_path) : null,
    telefonoVerificadoEn: f.phone_verified_at,
  };
}

async function leerPerfil(uid: string): Promise<Resultado<Perfil>> {
  const r = await correr<FilaPerfil>('leerPerfil', () =>
    supabase
      .from('user_profiles')
      .select('name, gender, gender_other, age_range, zone, cohabitation, income_sources, income_stability, main_goal, how_found_us, financial_level, reserve_ars, phone, terms_accepted_at, onboarding_v2, avatar_path, phone_verified_at')
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

/**
 * La reserva ("Plata apartada" en Objetivos, DEBT I12). Vive en
 * `user_profiles.reserve_ars` desde la migración 0023 (0041 lo re-asegura) y se
 * lee con el perfil en `leerPerfil`.
 *
 * Update y no upsert: la fila del perfil ya existe (la crea el trigger de auth)
 * y así no se puede crear una fila a medias. Con RLS, un update que no toca
 * ninguna fila no da error: por eso se pide la fila de vuelta y se trata "cero
 * filas" como falla, para que la pantalla vuelva atrás en vez de mentir.
 */
export async function guardarReserva(monto: number): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'guardarReserva');
  const r = await correr<{ id: string }[]>('guardarReserva', () =>
    supabase.from('user_profiles').update({ reserve_ars: Math.max(0, monto) }).eq('id', uid).select('id'),
  );
  if (r.error !== null) return falla<null>(r.error, 'guardarReserva');
  if (!r.data || r.data.length === 0) return falla<null>('sin fila', 'guardarReserva');
  return ok(null);
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

/**
 * Mueve el saldo de un medio de pago. `delta` negativo descuenta. Lo crea si
 * no existía.
 *
 * Va por RPC (`mover_saldo`, migración 0025) y NO por un "leer el saldo,
 * restar, escribir" desde acá: entre la lectura y la escritura puede entrar
 * otro gasto —del otro teléfono, o del bot, que escribe para todas— y esa
 * escritura se perdería. Un saldo que se pisa es plata que la persona cree
 * tener y no tiene.
 */
export async function moverSaldo(medio: string, delta: number): Promise<Resultado<null>> {
  return correr<null>('moverSaldo', () =>
    supabase.rpc('mover_saldo', { medio, delta }).then(({ error }) => ({ data: null, error })),
  );
}

/**
 * Une el medio `origen` en `destino`: suma los saldos y pasa todos los
 * movimientos, pagos divididos, gastos fijos y cargas. Es una función de la
 * base (migración 0038) para que sea una sola transacción: hecho desde acá en
 * varias llamadas, un corte a la mitad dejaría la plata repartida entre los
 * dos nombres.
 */
export async function unirMedios(origen: string, destino: string): Promise<Resultado<null>> {
  return correr<null>('unirMedios', () =>
    supabase.rpc('unir_medios', { origen, destino }).then(({ error }) => ({ data: null, error })),
  );
}

// ── Cargas de saldo ("Ya la tenía") ──────────────────────────────────────
// Cada vez que se suma plata que ya se tenía queda anotada con su fecha, para
// poder decir cuánto se cargó en cada mes. Ver migración 0037.
type FilaCarga = { id: string; medio: string; amount_ars: number; occurred_at: string };

export async function listarCargas(): Promise<Resultado<Carga[]>> {
  const r = await correr<FilaCarga[]>('listarCargas', () =>
    supabase.from('balance_loads').select('*').order('occurred_at', { ascending: false }).limit(500),
  );
  if (r.error !== null) return falla<Carga[]>(r.error, 'listarCargas');
  return ok((r.data ?? []).map((f) => ({ id: f.id, medio: f.medio, montoArs: Number(f.amount_ars), ts: new Date(f.occurred_at).getTime() })));
}

export async function registrarCarga(c: { id: string; medio: string; montoArs: number; ts: number }): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'registrarCarga');
  return correr<null>('registrarCarga', () =>
    supabase.from('balance_loads').insert({
      id: c.id, user_id: uid, medio: c.medio, amount_ars: c.montoArs, occurred_at: new Date(c.ts).toISOString(),
    }).then(({ error }) => ({ data: null, error })),
  );
}

/** Suma plata disponible a un medio. */
export function sumarDisponible(medio: string, monto: number): Promise<Resultado<null>> {
  return moverSaldo(medio, monto);
}

// ── Gastos ───────────────────────────────────────────────────────────────
type FilaGasto = {
  id: string; amount_ars: number; currency: string; original_amount: number | null;
  description: string | null; section_id: string | null; expense_type: string | null;
  payment_method: string | null; group_id: string | null; occurred_at: string; source: string;
  // Opcionales a propósito: vienen de las migraciones 0035 y 0036. Por eso las
  // consultas de gastos usan `*` y no una lista de columnas — pedir una
  // columna que todavía no existe tira error en TODAS las lecturas, no sólo en
  // las que la usan (así se rompió "ver mis gastos" cuando faltaba la 0035).
  payment_methods?: PagoMixto[] | null;
  expense_type_other?: string | null;
};

function aGasto(f: FilaGasto): Gasto {
  const moneda: MonedaConvertible = f.currency === 'USD' ? 'USD' : 'ARS';
  return {
    id: f.id,
    // En USD el monto que la persona tipeó vive en original_amount; amount_ars
    // es el equivalente congelado a la cotización de ese día.
    monto: moneda === 'USD' ? Number(f.original_amount ?? f.amount_ars) : Number(f.amount_ars),
    moneda,
    montoArs: Number(f.amount_ars),
    descripcion: f.description ?? '',
    seccionId: f.section_id,
    tipo: (f.expense_type ?? 'otro') as TipoGasto,
    metodoPago: f.payment_method,
    ...(f.expense_type_other ? { tipoOtro: f.expense_type_other } : {}),
    pagos: f.payment_methods?.length ? f.payment_methods : undefined,
    grupoId: f.group_id,
    ts: new Date(f.occurred_at).getTime(),
    origen: (f.source === 'whatsapp' ? 'whatsapp' : f.source === 'manual' ? 'manual' : 'web'),
  };
}

export async function listarGastos(): Promise<Resultado<Gasto[]>> {
  const r = await correr<FilaGasto[]>('listarGastos', () =>
    supabase.from('transactions')
      .select('*')
      .eq('type', 'expense')
      .order('occurred_at', { ascending: false })
      .limit(500),
  );
  if (r.error !== null) return falla<Gasto[]>(r.error, 'listarGastos');
  return ok((r.data ?? []).map(aGasto));
}

export async function registrarGasto(g: {
  id?: string;
  monto: number; moneda: MonedaConvertible; montoArs: number; cotizacionId?: string | null;
  descripcion: string; seccionId: string | null; tipo: TipoGasto; tipoOtro?: string;
  metodoPago: string | null; pagos?: PagoMixto[] | null; grupoId?: string | null; ts?: number;
}): Promise<Resultado<Gasto>> {
  const uid = await idUsuaria();
  if (!uid) return falla<Gasto>('sin sesión', 'registrarGasto');

  // Pagado con varios medios: `payment_method` (singular) queda en null y el
  // detalle vive en `payment_methods`. Con uno solo, al revés — como siempre.
  const dividido = !!g.pagos?.length;

  // Las columnas de `transactions`, sin `user_id`, `type` ni `source`: ésas
  // las pone la base (con la 0040) o el insert de abajo (sin ella).
  const fila: Record<string, unknown> = {
    ...(g.id ? { id: g.id } : {}),
    occurred_at: new Date(g.ts ?? Date.now()).toISOString(),
    amount_ars: g.montoArs,
    currency: g.moneda,
    original_amount: g.moneda === 'USD' ? g.monto : null,
    exchange_rate_id: g.cotizacionId ?? null,
    description: g.descripcion,
    section_id: g.seccionId,
    expense_type: g.tipo,
    // Las columnas de las migraciones 0035/0036 sólo se mandan cuando hay
    // algo para guardar en ellas: así un gasto común no depende de que
    // estén aplicadas.
    ...(g.tipo === 'otro' && g.tipoOtro ? { expense_type_other: g.tipoOtro } : {}),
    payment_method: dividido ? null : g.metodoPago,
    ...(dividido ? { payment_methods: g.pagos } : {}),
    group_id: g.grupoId ?? null,
  };

  // Con la migración 0040, la fila y los saldos van juntos en una sola
  // transacción de la base. Sin ella, lo de abajo: varias llamadas con vuelta
  // atrás a mano.
  const rpc = await rpcNueva<FilaGasto>('registrar_gasto', { fila }, 'registrarGasto');
  if (rpc) {
    if (rpc.error !== null || !rpc.data) return falla<Gasto>(rpc.error ?? 'sin fila', 'registrarGasto');
    return ok(aGasto(rpc.data));
  }

  const r = await correr<FilaGasto[]>('registrarGasto', () =>
    supabase.from('transactions').insert({
      ...fila,
      user_id: uid,
      type: 'expense',
      // 'web' = lo cargó la persona en la app. El bot escribe 'whatsapp'.
      source: 'web',
    }).select('*'),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Gasto>(r.error ?? 'sin fila', 'registrarGasto');

  // El gasto descuenta del medio (o los medios) con que se pagó, y de paso
  // cada uno queda como el más reciente (lo hace `mover_saldo`), así la
  // próxima vez se ofrece primero. Si un medio no existía, lo crea con saldo
  // negativo: es la verdad, gastaste con algo que nunca cargaste.
  const movimientos = dividido
    ? g.pagos!.map((p) => ({ medio: p.medio, delta: -p.monto }))
    : g.metodoPago ? [{ medio: g.metodoPago, delta: -g.montoArs }] : [];
  const saldo = await moverSaldos(movimientos);
  if (saldo.error !== null) {
    // Sin el descuento, el gasto quedaría registrado sin haber salido de
    // ningún lado: se borra, así la base queda como antes de intentarlo.
    await borrarFila('transactions', r.data[0].id, 'registrarGasto/deshacer');
    return falla<Gasto>(saldo.error, 'registrarGasto/saldo');
  }
  return ok(aGasto(r.data[0]));
}

/**
 * Aplica varios `mover_saldo` en orden. Si uno falla, devuelve los que ya se
 * habían aplicado: o se mueven todos, o ninguno. No es una transacción de la
 * base (eso lo hacen las funciones de la migración 0040, cuando está corrida),
 * pero cubre el caso común de que falle la red a mitad.
 */
async function moverSaldos(movimientos: { medio: string; delta: number }[]): Promise<Resultado<null>> {
  const hechos: { medio: string; delta: number }[] = [];
  for (const m of movimientos) {
    const r = await moverSaldo(m.medio, m.delta);
    if (r.error !== null) {
      for (const h of hechos.reverse()) await moverSaldo(h.medio, -h.delta);
      return falla<null>(r.error, 'moverSaldos');
    }
    hechos.push(m);
  }
  return ok(null);
}

/**
 * Lo que un movimiento le hizo a cada medio, leído de su fila: un gasto
 * dividido, cada parte; uno común, el total. `signo` es -1 para un gasto (le
 * sacó plata al medio) y +1 para un ingreso. Es la misma cuenta que hace
 * `efecto_en_medios` en la migración 0040.
 */
function efectoEnMedios(
  f: { amount_ars: number; payment_method: string | null; payment_methods?: PagoMixto[] | null } | null,
  signo: 1 | -1,
): { medio: string; delta: number }[] {
  if (!f) return [];
  if (f.payment_methods?.length) return f.payment_methods.map((p) => ({ medio: p.medio, delta: signo * Number(p.monto) }));
  return f.payment_method ? [{ medio: f.payment_method, delta: signo * Number(f.amount_ars ?? 0) }] : [];
}

const invertir = (movs: { medio: string; delta: number }[]) => movs.map((m) => ({ medio: m.medio, delta: -m.delta }));

// ── Funciones de la base que pueden no existir todavía ───────────────────
// Las migraciones se corren a mano y la preview usa la base de producción, así
// que el código tiene que andar con la migración corrida y sin correr. Una
// función que falta se reconoce por el error de PostgREST (PGRST202, "Could
// not find the function") o de Postgres (42883, "function ... does not
// exist"). Cuando falta, se recuerda hasta recargar para no pegarle de nuevo
// en cada guardado.
const funcionesQueFaltan = new Set<string>();

function faltaFuncion(error: { code?: string; message: string }): boolean {
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function|function .* does not exist/i.test(error.message);
}

/**
 * Llama a una función de la base que puede no existir. Devuelve `null` si no
 * existe (para que quien llama siga por el camino viejo), o el resultado.
 *
 * Una función que existe y falla corre en una sola transacción, así que no
 * dejó nada a medias: el error se devuelve tal cual, sin probar el camino
 * viejo (que podría hacer a medias lo que la base ya rechazó entero).
 */
async function rpcNueva<T>(nombre: string, args: Record<string, unknown>, contexto: string): Promise<Resultado<T> | null> {
  if (funcionesQueFaltan.has(nombre)) return null;
  try {
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) {
      if (faltaFuncion(error)) {
        funcionesQueFaltan.add(nombre);
        return null;
      }
      return falla<T>(error.message, contexto);
    }
    return ok(data as T);
  } catch (e) {
    return falla<T>(e, contexto);
  }
}

export async function editarGasto(id: string, g: {
  monto?: number; moneda?: MonedaConvertible; montoArs?: number; cotizacionId?: string | null;
  descripcion?: string; seccionId?: string | null; tipo?: TipoGasto;
  // `null` = borrar lo escrito antes; `undefined` = no tocar la columna.
  tipoOtro?: string | null;
  metodoPago?: string | null; pagos?: PagoMixto[] | null; ts?: number;
  // Cuánto sumar/restar del saldo de cada medio — lo calcula `acciones.ts`
  // (compara el medio/monto viejo contra el nuevo) porque acá no se lee el
  // estado anterior. Positivo = se le devuelve plata (se le sacó el gasto o
  // bajó); negativo = se le descuenta más.
  ajustesSaldo?: { medio: string; delta: number }[];
}, antes?: CambiosGasto): Promise<Resultado<null>> {
  const fila = filaDeGasto(g);

  // Con la 0040, la base actualiza y mueve los saldos en una transacción, y
  // los ajustes los calcula ella comparando la fila de antes con la de
  // después (`ajustesSaldo` no se usa). Sin cambios en la fila no hay nada que
  // mandarle.
  if (Object.keys(fila).length > 0) {
    const rpc = await rpcNueva<unknown>('editar_gasto', { id, cambios: fila }, 'editarGasto');
    if (rpc) return rpc.error !== null ? rpc : ok(null);
  }

  const actualizar = (f: Record<string, unknown>, contexto: string) => correr<null>(contexto, () =>
    supabase.from('transactions').update(f).eq('id', id).then(({ error }) => ({ data: null, error })),
  );

  if (Object.keys(fila).length > 0) {
    const r = await actualizar(fila, 'editarGasto');
    if (r.error !== null) return r;
  }

  // Antes esto faltaba: el monto o el medio cambiaban en pantalla pero el
  // saldo real en la base quedaba igual (mismo bug que describe 0025, acá
  // vía "editar" en vez de "crear"). Se arregla igual: un `mover_saldo`
  // atómico por cada medio afectado, nunca un update directo del saldo.
  const saldo = await moverSaldos(g.ajustesSaldo ?? []);
  if (saldo.error !== null) {
    // Los saldos ya volvieron (moverSaldos); la fila se deja como estaba, si
    // se sabe cómo estaba. Si no, quedaría con el monto nuevo y el saldo viejo.
    if (antes && Object.keys(fila).length > 0) await actualizar(filaDeGasto(antes), 'editarGasto/deshacer');
    return falla<null>(saldo.error, 'editarGasto/saldo');
  }
  return ok(null);
}

/** Los campos de un gasto que se pueden editar, con nombres de la app. */
export type CambiosGasto = {
  monto?: number; moneda?: MonedaConvertible; montoArs?: number; cotizacionId?: string | null;
  descripcion?: string; seccionId?: string | null; tipo?: TipoGasto; tipoOtro?: string | null;
  metodoPago?: string | null; pagos?: PagoMixto[] | null; ts?: number;
};

/** Pasa los cambios de un gasto a columnas de `transactions`; lo que viene undefined no se toca. */
function filaDeGasto(g: CambiosGasto): Record<string, unknown> {
  const fila: Record<string, unknown> = {};
  if (g.montoArs !== undefined) fila.amount_ars = g.montoArs;
  if (g.moneda !== undefined) fila.currency = g.moneda;
  if (g.monto !== undefined && g.moneda !== undefined) fila.original_amount = g.moneda === 'USD' ? g.monto : null;
  if (g.cotizacionId !== undefined) fila.exchange_rate_id = g.cotizacionId;
  if (g.descripcion !== undefined) fila.description = g.descripcion;
  if (g.seccionId !== undefined) fila.section_id = g.seccionId;
  if (g.tipo !== undefined) fila.expense_type = g.tipo;
  if (g.tipoOtro !== undefined) fila.expense_type_other = g.tipoOtro;
  if (g.metodoPago !== undefined) fila.payment_method = g.metodoPago;
  if (g.pagos !== undefined) fila.payment_methods = g.pagos?.length ? g.pagos : null;
  if (g.ts !== undefined) fila.occurred_at = new Date(g.ts).toISOString();
  return fila;
}

// ── Gastos fijos ─────────────────────────────────────────────────────────
type FilaGastoFijo = {
  id: string; description: string; amount: number; currency: string; section_id: string | null;
  expense_type: string | null; payment_method: string | null; frequency: string; next_due: string; anchor_day: number | null;
};

const FRECUENCIAS_FIJO = ['semanal', 'quincenal', 'mensual', 'anual'] as const;
const TIPOS_GASTO: TipoGasto[] = ['necesario', 'urgente', 'impulsivo', 'otro'];

function aGastoFijo(f: FilaGastoFijo): GastoFijo {
  return {
    id: f.id,
    descripcion: f.description,
    monto: Number(f.amount),
    moneda: f.currency === 'USD' ? 'USD' : 'ARS',
    seccionId: f.section_id,
    tipo: TIPOS_GASTO.find((t) => t === f.expense_type) ?? 'otro',
    metodoPago: f.payment_method,
    frecuencia: FRECUENCIAS_FIJO.find((x) => x === f.frequency) ?? 'mensual',
    proximoPago: f.next_due,
    diaAncla: f.anchor_day,
  };
}

export async function listarGastosFijos(): Promise<Resultado<GastoFijo[]>> {
  const r = await correr<FilaGastoFijo[]>('listarGastosFijos', () =>
    supabase.from('recurring_expenses')
      .select('id, description, amount, currency, section_id, expense_type, payment_method, frequency, next_due, anchor_day')
      .eq('active', true).order('next_due', { ascending: true }),
  );
  if (r.error !== null) return falla<GastoFijo[]>(r.error, 'listarGastosFijos');
  return ok((r.data ?? []).map(aGastoFijo));
}

export async function crearGastoFijo(g: GastoFijo): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'crearGastoFijo');
  return correr<null>('crearGastoFijo', () =>
    supabase.from('recurring_expenses').insert({
      id: g.id, user_id: uid, description: g.descripcion, amount: g.monto, currency: g.moneda,
      section_id: g.seccionId, expense_type: g.tipo, payment_method: g.metodoPago,
      frequency: g.frecuencia, next_due: g.proximoPago, anchor_day: g.diaAncla,
    }).then(({ error }) => ({ data: null, error })),
  );
}

/** Pasa el gasto fijo a su próximo vencimiento (después de "Ya lo pagué"). */
export async function avanzarGastoFijo(id: string, proximoPago: string): Promise<Resultado<null>> {
  return correr<null>('avanzarGastoFijo', () =>
    supabase.from('recurring_expenses')
      .update({ next_due: proximoPago, last_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).select('id')
      .then(({ data, error }) => ({ data: null, error: error ?? (data && data.length === 0 ? { message: 'no se pudo actualizar' } : null) })),
  );
}

export async function borrarGastoFijo(id: string): Promise<Resultado<null>> {
  return borrarFila('recurring_expenses', id, 'borrarGastoFijo');
}

// ── Ingresos ─────────────────────────────────────────────────────────────
// Plata que entra: `transactions` con type = 'income'. El mismo formato que usa
// el bot (docs/bot-ingresos.md), así un ingreso contado por WhatsApp y uno
// cargado en la app son exactamente lo mismo.
type FilaIngreso = {
  id: string; amount_ars: number; currency: string; original_amount: number | null;
  description: string | null; payment_method: string | null; occurred_at: string; source: string;
  income_source?: string | null;
  income_source_other?: string | null;
};

const FUENTES: FuenteIngreso[] = ['sueldo', 'freelance', 'venta', 'regalo', 'reintegro', 'otro'];

function aIngreso(f: FilaIngreso): Ingreso {
  const moneda: MonedaConvertible = f.currency === 'USD' ? 'USD' : 'ARS';
  const fuente = FUENTES.find((x) => x === f.income_source) ?? null;
  return {
    id: f.id,
    monto: moneda === 'USD' && f.original_amount ? Number(f.original_amount) : Number(f.amount_ars),
    moneda,
    montoArs: Number(f.amount_ars),
    fuente,
    ...(fuente === 'otro' && f.income_source_other ? { fuenteOtra: f.income_source_other } : {}),
    descripcion: f.description ?? '',
    medio: f.payment_method,
    ts: new Date(f.occurred_at).getTime(),
    origen: f.source === 'whatsapp' ? 'whatsapp' : f.source === 'manual' ? 'manual' : 'web',
  };
}

export async function listarIngresos(): Promise<Resultado<Ingreso[]>> {
  // `*` y no columnas sueltas: sin la migración 0033 no existe income_source, y
  // pedirla por nombre haría fallar la lectura entera.
  const r = await correr<FilaIngreso[]>('listarIngresos', () =>
    supabase.from('transactions').select('*').eq('type', 'income')
      .order('occurred_at', { ascending: false }).limit(500),
  );
  if (r.error !== null) return falla<Ingreso[]>(r.error, 'listarIngresos');
  return ok((r.data ?? []).map(aIngreso));
}

export async function registrarIngreso(i: {
  id?: string; monto: number; moneda: MonedaConvertible; montoArs: number; cotizacionId?: string | null;
  fuente: FuenteIngreso | null; fuenteOtra?: string; descripcion: string; medio: string; ts?: number;
}): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'registrarIngreso');
  const fila: Record<string, unknown> = {
    ...(i.id ? { id: i.id } : {}),
    occurred_at: new Date(i.ts ?? Date.now()).toISOString(),
    amount_ars: i.montoArs,
    currency: i.moneda,
    original_amount: i.moneda === 'USD' ? i.monto : null,
    exchange_rate_id: i.cotizacionId ?? null,
    description: i.descripcion || null,
    payment_method: i.medio,
    ...(i.fuente ? { income_source: i.fuente } : {}),
    ...(i.fuente === 'otro' && i.fuenteOtra ? { income_source_other: i.fuenteOtra } : {}),
  };

  // Con la 0040, fila y saldo en una sola transacción. Sin ella, lo de abajo.
  const rpc = await rpcNueva<unknown>('registrar_ingreso', { fila }, 'registrarIngreso');
  if (rpc) return rpc.error !== null ? rpc : ok(null);

  const w = await correr<null>('registrarIngreso', () =>
    supabase.from('transactions').insert({ ...fila, user_id: uid, type: 'income', source: 'web' })
      .then(({ error }) => ({ data: null, error })),
  );
  if (w.error !== null) return w;
  // Entró plata en ese medio: su saldo sube. Mismo `mover_saldo` que los gastos.
  const saldo = await moverSaldo(i.medio, i.montoArs);
  if (saldo.error !== null) {
    // Igual que con un gasto: sin el saldo, el ingreso no queda registrado.
    if (i.id) await borrarFila('transactions', i.id, 'registrarIngreso/deshacer');
    return falla<null>(saldo.error, 'registrarIngreso/saldo');
  }
  return ok(null);
}

/** Los campos de un ingreso que se pueden editar, con nombres de la app. */
export type CambiosIngreso = {
  monto?: number; moneda?: MonedaConvertible; montoArs?: number; cotizacionId?: string | null;
  fuente?: FuenteIngreso | null;
  // `null` = borrar lo escrito antes; `undefined` = no tocar la columna (así un
  // edit común no depende de la migración 0036).
  fuenteOtra?: string | null;
  descripcion?: string; medio?: string; ts?: number;
};

/** Pasa los cambios de un ingreso a columnas de `transactions`; lo que viene undefined no se toca. */
function filaDeIngreso(g: CambiosIngreso): Record<string, unknown> {
  const fila: Record<string, unknown> = {};
  if (g.montoArs !== undefined) fila.amount_ars = g.montoArs;
  if (g.moneda !== undefined) fila.currency = g.moneda;
  if (g.monto !== undefined && g.moneda !== undefined) fila.original_amount = g.moneda === 'USD' ? g.monto : null;
  if (g.cotizacionId !== undefined) fila.exchange_rate_id = g.cotizacionId;
  if (g.descripcion !== undefined) fila.description = g.descripcion || null;
  if (g.medio !== undefined) fila.payment_method = g.medio;
  if (g.fuente !== undefined) fila.income_source = g.fuente;
  if (g.fuenteOtra !== undefined) fila.income_source_other = g.fuenteOtra;
  if (g.ts !== undefined) fila.occurred_at = new Date(g.ts).toISOString();
  return fila;
}

/**
 * Edita un ingreso. Cambiar el monto o el medio mueve plata: el medio viejo
 * pierde lo que había recibido y el nuevo lo recibe.
 *
 * Con la migración 0040 lo hace la base en una sola transacción, y calcula ella
 * cuánto mover. Sin la 0040, `acciones.ts` calcula esos ajustes (acá no se lee
 * el estado anterior) y se aplican con `mover_saldo`, igual que al editar un
 * gasto: si falla el saldo, los saldos ya movidos vuelven y la fila vuelve a
 * `antes` (las mismas columnas, con los valores de antes).
 */
export async function editarIngreso(id: string, g: CambiosIngreso & {
  ajustesSaldo?: { medio: string; delta: number }[];
}, antes?: CambiosIngreso): Promise<Resultado<null>> {
  const fila = filaDeIngreso(g);

  if (Object.keys(fila).length > 0) {
    const rpc = await rpcNueva<unknown>('editar_ingreso', { id, cambios: fila }, 'editarIngreso');
    if (rpc) return rpc.error !== null ? rpc : ok(null);
  }

  const actualizar = (f: Record<string, unknown>, contexto: string) => correr<null>(contexto, () =>
    supabase.from('transactions').update(f).eq('id', id).eq('type', 'income').then(({ error }) => ({ data: null, error })),
  );

  if (Object.keys(fila).length > 0) {
    const r = await actualizar(fila, 'editarIngreso');
    if (r.error !== null) return r;
  }
  const saldo = await moverSaldos(g.ajustesSaldo ?? []);
  if (saldo.error !== null) {
    if (antes && Object.keys(fila).length > 0) await actualizar(filaDeIngreso(antes), 'editarIngreso/deshacer');
    return falla<null>(saldo.error, 'editarIngreso/saldo');
  }
  return ok(null);
}

/** Borra un ingreso y le saca esa plata al medio en el que había entrado. */
export async function borrarIngreso(id: string): Promise<Resultado<null>> {
  const rpc = await rpcNueva<unknown>('borrar_ingreso', { id }, 'borrarIngreso');
  if (rpc) return rpc.error !== null ? rpc : ok(null);
  return borrarMovimiento(id, 1, 'borrarIngreso');
}

/**
 * El camino sin la migración 0040 para borrar un gasto o un ingreso.
 *
 * Se lee la fila antes: el monto en pesos y el medio salen de ahí, no de lo que
 * crea el cliente. Si la lectura falla no se borra: sin la fila no se sabe
 * cuánto devolver, y borrar igual dejaría el saldo mal para siempre.
 *
 * Primero se devuelve la plata y DESPUÉS se borra. Al revés, si fallaba el
 * saldo después de borrar no había vuelta atrás (una fila borrada no se puede
 * volver a insertar igual desde acá). Así, si falla el saldo no se borró nada,
 * y si falla el borrado se deshace el movimiento de saldo.
 */
async function borrarMovimiento(id: string, signo: 1 | -1, contexto: string): Promise<Resultado<null>> {
  // `*` y no columnas sueltas: `payment_methods` (0035) puede no existir aún.
  const previo = await correr<{ amount_ars: number; payment_method: string | null; payment_methods?: PagoMixto[] | null } | null>(`${contexto}/leer`, () =>
    supabase.from('transactions').select('*').eq('id', id).maybeSingle(),
  );
  if (previo.error !== null) return falla<null>(previo.error, `${contexto}/leer`);

  // Lo contrario de lo que el movimiento le hizo a cada medio.
  const devolver = invertir(efectoEnMedios(previo.data, signo));
  const saldo = await moverSaldos(devolver);
  if (saldo.error !== null) return falla<null>(saldo.error, `${contexto}/saldo`);

  const borrado = await borrarFila('transactions', id, contexto);
  if (borrado.error !== null) {
    await moverSaldos(invertir(devolver));
    return borrado;
  }
  return ok(null);
}

/**
 * Borra UNA fila por id y confirma que de verdad se borró.
 *
 * Supabase no da error cuando un borrado no borra nada: si la base no deja
 * borrar esa fila (una policy, o la fila ya no existe), contesta "ok" con cero
 * filas. Sin este chequeo la app mostraba "se borró" y al recargar el gasto
 * volvía. Por eso se pide que devuelva lo que borró, y si no borró nada, es un
 * error.
 */
async function borrarFila(tabla: string, id: string, contexto: string): Promise<Resultado<null>> {
  const r = await correr<{ id: string }[]>(contexto, () =>
    supabase.from(tabla).delete().eq('id', id).select('id'),
  );
  if (r.error !== null) {
    return falla<null>(/foreign key/i.test(r.error) ? 'no se puede borrar porque está usado en otro lado' : r.error, contexto);
  }
  if (!r.data || r.data.length === 0) return falla<null>('no se pudo borrar. Volvé a cargar y probá de nuevo', contexto);
  return ok(null);
}

/**
 * Borra un gasto y le devuelve la plata al medio (o a cada medio, si se
 * dividió) con el que se pagó. Si sólo se borrara el gasto, el disponible
 * quedaría descontado para siempre por algo que ya no existe.
 *
 * Con la migración 0040 lo hace la base en una sola transacción; sin ella,
 * `borrarMovimiento`.
 */
export async function borrarGasto(id: string): Promise<Resultado<null>> {
  const rpc = await rpcNueva<unknown>('borrar_gasto', { id }, 'borrarGasto');
  if (rpc) return rpc.error !== null ? rpc : ok(null);
  return borrarMovimiento(id, -1, 'borrarGasto');
}

// ── Objetivos ────────────────────────────────────────────────────────────
type FilaObjetivo = {
  id: string; title: string; description: string | null; amount_ars: number | null;
  amount_min_ars: number | null; amount_mode: string | null;
  currency: string; horizon_label: string | null; kind: string; status: string;
  goal_contributions: { id: string; amount: number; currency: string; amount_ars: number; kind: string; label: string | null; occurred_at: string; user_id: string }[] | null;
};

export async function listarObjetivos(): Promise<Resultado<Objetivo[]>> {
  const r = await correr<FilaObjetivo[]>('listarObjetivos', () =>
    supabase.from('goals')
      .select('id, title, description, amount_ars, amount_min_ars, amount_mode, currency, horizon_label, kind, status, goal_contributions(id, amount, currency, amount_ars, kind, label, occurred_at, user_id)')
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
    modoMonto: (f.amount_mode as Objetivo['modoMonto']) ?? null,
    montoTotal: f.amount_ars == null ? null : Number(f.amount_ars),
    montoMin: f.amount_min_ars == null ? null : Number(f.amount_min_ars),
    estado: (f.status as Objetivo['estado']) ?? 'active',
    contribuciones: (f.goal_contributions ?? [])
      .map((c): Contribucion => ({
        id: c.id,
        monto: Number(c.amount),
        moneda: (c.currency === 'USD' ? 'USD' : 'ARS') as Moneda,
        montoArs: c.amount_ars == null ? null : Number(c.amount_ars),
        kind: c.kind === 'paid' ? 'paid' : 'saved',
        label: c.label,
        ts: new Date(c.occurred_at).getTime(),
        deUserId: c.user_id,
      }))
      .sort((a, b) => b.ts - a.ts),
  })));
}

export async function crearObjetivo(o: {
  id?: string;
  nombre: string; descripcion?: string; tipo?: 'individual' | 'grupal';
  moneda?: Moneda; horizonte?: string | null; montoTotal: number | null;
  modoMonto?: Objetivo['modoMonto']; montoMin?: number | null;
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
      amount_min_ars: o.montoMin ?? null,
      amount_mode: o.modoMonto ?? null,
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
    modoMonto: o.modoMonto ?? null,
    montoTotal: o.montoTotal,
    montoMin: o.montoMin ?? null,
    estado: 'active',
    contribuciones: [],
  });
}

export async function editarObjetivo(id: string, o: Partial<Pick<Objetivo, 'nombre' | 'descripcion' | 'tipo' | 'moneda' | 'horizonte' | 'montoTotal' | 'montoMin' | 'modoMonto' | 'estado'>>): Promise<Resultado<null>> {
  const fila: Record<string, unknown> = {};
  if (o.nombre !== undefined) fila.title = o.nombre;
  if (o.descripcion !== undefined) fila.description = o.descripcion || null;
  if (o.tipo !== undefined) fila.kind = o.tipo;
  if (o.moneda !== undefined) fila.currency = o.moneda;
  if (o.horizonte !== undefined) fila.horizon_label = o.horizonte;
  if (o.montoTotal !== undefined) fila.amount_ars = o.montoTotal;
  if (o.montoMin !== undefined) fila.amount_min_ars = o.montoMin;
  if (o.modoMonto !== undefined) fila.amount_mode = o.modoMonto;
  if (o.estado !== undefined) fila.status = o.estado;
  if (Object.keys(fila).length === 0) return ok(null);

  return correr<null>('editarObjetivo', () =>
    supabase.from('goals').update(fila).eq('id', id).then(({ error }) => ({ data: null, error })),
  );
}

export async function borrarObjetivo(id: string): Promise<Resultado<null>> {
  return borrarFila('goals', id, 'borrarObjetivo');
}

export async function sumarContribucion(objetivoId: string, c: {
  id?: string;
  monto: number; moneda: Moneda; montoArs: number | null; cotizacionId?: string | null;
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
    kind: c.kind, label: c.label ?? null, ts: c.ts ?? Date.now(), deUserId: uid,
  });
}

export async function borrarContribucion(id: string): Promise<Resultado<null>> {
  return borrarFila('goal_contributions', id, 'borrarContribucion');
}

// ── Inversiones ──────────────────────────────────────────────────────────
export async function leerPerfilInversor(): Promise<Resultado<PerfilInversor | null>> {
  const r = await correr<{ horizon: string | null; reaction: string | null; already_invests: boolean | null; invests_in: string[] | null; wallets: string[] | null; completed_at: string | null } | null>(
    'leerPerfilInversor',
    () => supabase.from('investment_profiles').select('horizon, reaction, already_invests, invests_in, wallets, completed_at').maybeSingle(),
  );
  if (r.error !== null) return falla<PerfilInversor | null>(r.error, 'leerPerfilInversor');
  if (!r.data) return ok(null);
  return ok({
    porQue: r.data.horizon,
    reaccion: r.data.reaction,
    yaInvierte: r.data.already_invests,
    enQue: r.data.invests_in ?? [],
    bancos: r.data.wallets ?? [],
    completadoEn: r.data.completed_at,
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
      completed_at: p.completadoEn,
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
    moneda: (f.currency === 'USD' ? 'USD' : 'ARS') as MonedaConvertible,
    montoArs: Number(f.amount_ars),
    cotizacion: null,
    ts: new Date(f.occurred_at).getTime(),
  })));
}

export async function sumarAporte(a: {
  id?: string;
  instrumento: string; monto: number; moneda: MonedaConvertible; montoArs: number; cotizacionId?: string | null; ts?: number;
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

export async function editarAporte(id: string, a: { instrumento?: string; monto?: number; moneda?: MonedaConvertible; montoArs?: number; cotizacionId?: string | null }): Promise<Resultado<null>> {
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
  return borrarFila('investment_contributions', id, 'borrarAporte');
}

// ── El paso del día y la racha ───────────────────────────────────────────
// Ver api/v2/pasos.ts (qué paso toca y cuándo está cumplido) y la migración
// 0028 (cómo se guarda y cómo se calcula la racha con el comodín).

export async function leerPasoDelDia(dia: string): Promise<Resultado<PasoGuardado | null>> {
  type Fila = { day: string; step_key: string; completed_at: string | null; message?: string | null };
  let r = await correr<Fila | null>('leerPasoDelDia', () =>
    supabase.from('daily_steps').select('day, step_key, completed_at, message').eq('day', dia).maybeSingle(),
  );
  // Sin la migración 0029 la columna `message` no existe: se lee sin ella, así
  // el paso del día sigue andando antes de correrla.
  if (r.error !== null && r.error.includes('message')) {
    r = await correr<Fila | null>('leerPasoDelDia', () =>
      supabase.from('daily_steps').select('day, step_key, completed_at').eq('day', dia).maybeSingle(),
    );
  }
  if (r.error !== null) return falla(r.error, 'leerPasoDelDia');
  if (!r.data) return ok(null);
  return ok({ dia: r.data.day, clave: r.data.step_key, cumplidoEn: r.data.completed_at, mensaje: r.data.message ?? null });
}

/**
 * Guarda el paso de un día y devuelve el que QUEDÓ guardado.
 *
 * Si dos dispositivos abren la app a la vez, los dos eligen y los dos intentan
 * guardar. El `ignoreDuplicates` hace que gane el primero y el segundo no
 * pise nada; después se relee, así los dos muestran el mismo paso en vez de
 * cada uno el suyo.
 */
export async function asignarPasoDelDia(dia: string, clave: string, mensaje: string | null = null): Promise<Resultado<PasoGuardado | null>> {
  const uid = await idUsuaria();
  if (!uid) return falla('sin sesión', 'asignarPasoDelDia');
  const w = await correr<null>('asignarPasoDelDia', () =>
    supabase.from('daily_steps')
      // `message` sólo si hay: sin la migración 0029 la columna no existe, y
      // sin mensaje (paso de la regla) no hace falta mandarla.
      .upsert({ user_id: uid, day: dia, step_key: clave, ...(mensaje ? { message: mensaje } : {}) }, { onConflict: 'user_id,day', ignoreDuplicates: true })
      .then(({ error }) => ({ data: null, error })),
  );
  if (w.error !== null) return falla(w.error, 'asignarPasoDelDia');
  return leerPasoDelDia(dia);
}

export async function cumplirPasoDelDia(dia: string): Promise<Resultado<null>> {
  return correr<null>('cumplirPasoDelDia', () =>
    supabase.from('daily_steps')
      .update({ completed_at: new Date().toISOString() })
      .eq('day', dia)
      // Sólo si todavía no estaba cumplido: la fecha que queda es la primera.
      .is('completed_at', null)
      .then(({ error }) => ({ data: null, error })),
  );
}

// ── El próximo paso (migración 0042) ─────────────────────────────────────
// Los pasos grandes ("Hacé tu primera inversión") pasan afuera de la app, así
// que la persona marca a mano cuando los hizo. Se guardan las claves marcadas.

/** Los próximos pasos que la persona marcó como hechos, con cuándo. */
export async function leerProximosPasosHechos(): Promise<Resultado<{ clave: string; completadoEn: string }[]>> {
  const r = await correr<{ step_key: string; completed_at: string }[]>('leerProximosPasosHechos', () =>
    supabase.from('next_steps').select('step_key, completed_at'),
  );
  if (r.error !== null) return falla(r.error, 'leerProximosPasosHechos');
  return ok((r.data ?? []).map((f) => ({ clave: f.step_key, completadoEn: f.completed_at })));
}

export async function marcarProximoPaso(clave: string): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla('sin sesión', 'marcarProximoPaso');
  return correr<null>('marcarProximoPaso', () =>
    supabase.from('next_steps')
      // Marcar dos veces no es un error: queda la primera fecha.
      .upsert({ user_id: uid, step_key: clave }, { onConflict: 'user_id,step_key', ignoreDuplicates: true })
      .then(({ error }) => ({ data: null, error })),
  );
}

export async function desmarcarProximoPaso(clave: string): Promise<Resultado<null>> {
  return correr<null>('desmarcarProximoPaso', () =>
    supabase.from('next_steps').delete().eq('step_key', clave).then(({ error }) => ({ data: null, error })),
  );
}

export async function leerRacha(): Promise<Resultado<Racha>> {
  const r = await correr<Racha>('leerRacha', () =>
    supabase.rpc('mi_racha').then(({ data, error }) => ({ data: data as Racha | null, error })),
  );
  if (r.error !== null) return falla(r.error, 'leerRacha');
  return ok(r.data ?? RACHA_VACIA);
}

// ── Verificación del teléfono por WhatsApp ───────────────────────────────
// El bot no puede escribirle primero a nadie (WhatsApp sólo deja iniciar una
// conversación con plantilla aprobada y pagando), así que la verificación va al
// revés: la persona le manda un código al bot. Eso prueba que el número es suyo
// —la misma garantía que un OTP por SMS— y de paso deja la conversación abierta.
//
// Ver la migración 0026 y docs/whatsapp-bot-flujo-v2.md §3.1.c.

export async function pedirCodigoTelefono(telefono: string | null): Promise<Resultado<string>> {
  return correr<string>('pedirCodigoTelefono', () =>
    supabase.rpc('pedir_codigo_telefono', { telefono }).then(({ data, error }) => ({
      data: data as string | null,
      error,
    })),
  );
}

/** El momento en que se verificó, o null. Se consulta mientras se espera. */
export async function leerTelefonoVerificado(): Promise<Resultado<{ verificadoEn: string | null; telefono: string | null }>> {
  const uid = await idUsuaria();
  if (!uid) return falla('sin sesión', 'leerTelefonoVerificado');
  const r = await correr<{ phone: string | null; phone_verified_at: string | null } | null>(
    'leerTelefonoVerificado',
    () => supabase.from('user_profiles').select('phone, phone_verified_at').eq('id', uid).maybeSingle(),
  );
  if (r.error !== null) return falla(r.error, 'leerTelefonoVerificado');
  return ok({ verificadoEn: r.data?.phone_verified_at ?? null, telefono: r.data?.phone ?? null });
}

// ── Foto de perfil ───────────────────────────────────────────────────────
// La foto va a Storage, no a la fila. Antes vivía como data URL (base64) en
// localStorage: no sobrevivía a cambiar de teléfono, no la podían ver las
// demás miembras del grupo, y hacía pesado cada arranque de la app.
//
// La ruta es `<uid>/avatar.<ext>` y las policies del bucket sólo dejan escribir
// dentro de la carpeta propia (ver la migración 0024). El bucket es público en
// lectura porque la foto se muestra en el ranking del grupo, y firmar una URL
// por avatar en cada render es latencia sin beneficio: la ruta es un uuid, no
// se adivina.
const BUCKET_AVATARES = 'avatars';

export async function subirFoto(archivo: File): Promise<Resultado<string>> {
  const uid = await idUsuaria();
  if (!uid) return falla<string>('sin sesión', 'subirFoto');

  const ext = (archivo.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const ruta = `${uid}/avatar.${ext}`;

  const sub = await correr<null>('subirFoto', () =>
    supabase.storage.from(BUCKET_AVATARES)
      // upsert: reemplaza la foto anterior en vez de acumular una por cambio.
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined })
      .then(({ error }) => ({ data: null, error })),
  );
  if (sub.error !== null) return falla<string>(sub.error, 'subirFoto');

  const guardar = await guardarRutaFoto(ruta);
  if (guardar.error !== null) return falla<string>(guardar.error, 'subirFoto/perfil');
  return ok(urlDeFoto(ruta));
}

export async function borrarFoto(): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'borrarFoto');

  const actual = await correr<{ avatar_path: string | null } | null>('borrarFoto/leer', () =>
    supabase.from('user_profiles').select('avatar_path').eq('id', uid).maybeSingle(),
  );
  const ruta = actual.data?.avatar_path;
  if (ruta) {
    await correr<null>('borrarFoto/storage', () =>
      supabase.storage.from(BUCKET_AVATARES).remove([ruta]).then(({ error }) => ({ data: null, error })),
    );
  }
  return guardarRutaFoto(null);
}

function guardarRutaFoto(ruta: string | null): Promise<Resultado<null>> {
  return correr<null>('guardarRutaFoto', async () => {
    const uid = await idUsuaria();
    if (!uid) return { data: null, error: { message: 'sin sesión' } };
    const { error } = await supabase.from('user_profiles').update({ avatar_path: ruta }).eq('id', uid);
    return { data: null, error };
  });
}

/** URL pública de una ruta del bucket. Cache-buster para ver el cambio ya. */
export function urlDeFoto(ruta: string): string {
  const { data } = supabase.storage.from(BUCKET_AVATARES).getPublicUrl(ruta);
  return `${data.publicUrl}?v=${Date.now()}`;
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

/**
 * Crea el grupo y te deja como owner, en una sola operación.
 *
 * Va por RPC y no por un insert desde acá por dos razones, las dos de la
 * migración 0024:
 *
 * 1. La policy de lectura de `groups` es "sos miembro". En el instante del
 *    insert todavía no lo sos, así que el `RETURNING` volvía VACÍO —RLS
 *    también filtra lo que devuelve un insert— y la app veía un error sobre un
 *    grupo que sí se había creado.
 * 2. El grupo y la membresía tienen que ir juntos. En dos operaciones
 *    separadas, si la segunda falla queda un grupo huérfano que nadie puede
 *    ver ni borrar, con su código ocupado para siempre.
 *
 * El código lo genera la base, que es la que sabe cuáles están libres.
 */
export async function crearGrupo(nombre: string): Promise<Resultado<Grupo>> {
  const r = await correr<{ id: string; name: string; code: string }[]>('crearGrupo', () =>
    supabase.rpc('crear_grupo', { nombre }).then(({ data, error }) => ({
      data: data as { id: string; name: string; code: string }[] | null,
      error,
    })),
  );
  if (r.error !== null || !r.data?.[0]) return falla<Grupo>(r.error ?? 'sin fila', 'crearGrupo');
  const g = r.data[0];
  const uid = await idUsuaria();
  return ok({
    id: g.id,
    nombre: g.name,
    codigo: g.code,
    // Recién creado: la única miembra sos vos, y arrancás en cero.
    miembros: [{ userId: uid ?? '', nombre: '', actividad: 0, rol: 'owner', sosVos: true }],
  });
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

  // Con la migración 0039 la suma es atómica en la base (`sumar_actividad`), y
  // el cliente ya no puede escribir la actividad directo. Sin la 0039, el leer
  // y escribir de siempre (que con dos registros a la vez puede perder uno).
  const rpc = await rpcNueva<unknown>('sumar_actividad', { grupo: grupoId, n: delta }, 'sumarActividad');
  if (rpc) return rpc.error !== null ? rpc : ok(null);

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

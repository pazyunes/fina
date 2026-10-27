// Contrato de datos del flujo v2. Es la única definición de estas formas: los
// componentes no vuelven a declararlas (§9 de la guía — los tipos compartidos
// viven en la capa de API porque son el contrato con el backend).

// Las monedas que la app ofrece elegir. FINA tiene UNA cotización (dólar
// blue), así que sólo ARS y USD se pueden pasar a pesos; en las demás, el
// objetivo lleva su cuenta en su propia moneda (juntaste 400 de 1.200 euros).
export type Moneda = 'ARS' | 'USD' | 'EUR' | 'BRL' | 'CLP' | 'UYU' | 'GBP' | 'MXN';

/** Las únicas que se pueden convertir a pesos. */
export type MonedaConvertible = 'ARS' | 'USD';
export function esConvertible(m: Moneda): m is MonedaConvertible {
  return m === 'ARS' || m === 'USD';
}
export type Periodo = 'semana' | 'mes';
export type TipoGasto = 'necesario' | 'urgente' | 'impulsivo' | 'desorganizado' | 'excepcion' | 'otro';

/**
 * Los tipos que la base todavía no tiene como tales (el check de `expense_type`
 * sólo acepta los cuatro de siempre): se guardan como "otro" con este texto en
 * `expense_type_other`. Así no hace falta migración y el bot de WhatsApp los
 * lee como un "otro" con nombre.
 */
export const TIPOS_GUARDADOS_COMO_OTRO: Partial<Record<TipoGasto, string>> = {
  desorganizado: 'Desorganizado/a',
  excepcion: 'Excepción',
};

/** Lo que va a las columnas `expense_type` y `expense_type_other`. */
export function tipoParaLaBase(tipo: TipoGasto): { tipo: 'necesario' | 'urgente' | 'impulsivo' | 'otro'; otro?: string } {
  const texto = TIPOS_GUARDADOS_COMO_OTRO[tipo];
  if (texto) return { tipo: 'otro', otro: texto };
  return { tipo: tipo === 'desorganizado' || tipo === 'excepcion' ? 'otro' : tipo };
}

/** Al revés: lo guardado como "otro" con el texto de uno de los tipos nuevos vuelve a ser ese tipo. */
export function tipoDesdeLaBase(tipo: string | null, otro: string | null | undefined): { tipo: TipoGasto; tipoOtro?: string } {
  const base = (tipo ?? 'otro');
  if (base === 'otro') {
    const texto = otro?.trim().toLowerCase();
    const nuevo = (Object.keys(TIPOS_GUARDADOS_COMO_OTRO) as TipoGasto[]).find((t) => TIPOS_GUARDADOS_COMO_OTRO[t]?.toLowerCase() === texto);
    if (nuevo) return { tipo: nuevo };
    return otro ? { tipo: 'otro', tipoOtro: otro } : { tipo: 'otro' };
  }
  return { tipo: base as TipoGasto };
}
export type KindAporte = 'paid' | 'saved';

export type Seccion = {
  id: string;
  nombre: string;
  slug: string;
  tope: { monto: number; periodo: Periodo } | null;
};

export type MedioPago = {
  id: string;
  nombre: string;
  saldo: number;
  usadoEn: string | null;
};

/** De dónde vino la plata. Las mismas palabras que usa el bot (migración 0033). */
export type FuenteIngreso = 'sueldo' | 'freelance' | 'venta' | 'regalo' | 'reintegro' | 'otro';
export const FUENTES_INGRESO: { id: FuenteIngreso; label: string }[] = [
  { id: 'sueldo', label: 'Sueldo' },
  { id: 'freelance', label: 'Freelance / changas' },
  { id: 'venta', label: 'Una venta' },
  { id: 'regalo', label: 'Un regalo' },
  { id: 'reintegro', label: 'Reintegro' },
  { id: 'otro', label: 'Otro' },
];

/** Un gasto que se repite (alquiler, gimnasio…). Ver migración 0034. */
export type GastoFijo = {
  id: string;
  descripcion: string;
  monto: number;
  moneda: MonedaConvertible;
  seccionId: string | null;
  tipo: TipoGasto;
  metodoPago: string | null;
  frecuencia: 'semanal' | 'quincenal' | 'mensual' | 'anual';
  /** Próximo pago, 'YYYY-MM-DD' en Argentina. */
  proximoPago: string;
  /** Día del mes en que vence (mensual y anual). */
  diaAncla: number | null;
};

/** Plata que se cargó como "Ya la tenía": suma al medio pero no es un ingreso. Ver migración 0037. */
export type Carga = { id: string; medio: string; montoArs: number; ts: number };

/** Plata que entró: un movimiento de `transactions` con type = 'income'. */
export type Ingreso = {
  id: string;
  monto: number;
  moneda: MonedaConvertible;
  /** En pesos, congelado a la cotización de ese día. Todo lo que suma usa esto. */
  montoArs: number;
  fuente: FuenteIngreso | null;
  /** Lo que la persona escribió cuando eligió la fuente "otro" (migración 0036). */
  fuenteOtra?: string;
  descripcion: string;
  /** En qué medio entró. Su saldo en payment_methods sube por este monto. */
  medio: string | null;
  ts: number;
  origen: 'web' | 'whatsapp' | 'manual';
};

export type Gasto = {
  id: string;
  monto: number;
  /** Un gasto siempre entra al total en pesos, así que su moneda se convierte. */
  moneda: MonedaConvertible;
  /**
   * El equivalente en pesos, congelado a la cotización del día del gasto.
   * En pesos es igual a `monto`. Hace falta guardarlo acá y no recalcularlo
   * para poder devolver la plata al medio de pago si el gasto se borra.
   */
  montoArs: number;
  descripcion: string;
  seccionId: string | null;
  tipo: TipoGasto;
  /** Lo que la persona escribió cuando eligió el tipo "otro" (migración 0036). */
  tipoOtro?: string;
  metodoPago: string | null;
  grupoId: string | null;
  ts: number;
  /** 'web' = cargado en la app · 'whatsapp' = cargado por el bot */
  origen: 'web' | 'whatsapp' | 'manual';
  /**
   * Cuando el gasto se pagó con más de un medio: el detalle de cuánto salió
   * de cada uno (suma = `montoArs`). `undefined`/vacío = se pagó con un solo
   * medio, el de `metodoPago` de toda la vida.
   */
  pagos?: PagoMixto[];
};

export type PagoMixto = { medio: string; monto: number };

export type Contribucion = {
  id: string;
  monto: number;
  moneda: Moneda;
  /** null = esa moneda no tiene cotización en FINA. No es cero. */
  montoArs: number | null;
  kind: KindAporte;
  label: string | null;
  ts: number;
  /** Quién lo puso. En un objetivo grupal es la que hace la diferencia. */
  deUserId: string;
};

/**
 * Cómo se sabe cuánto cuesta el objetivo.
 * 'exacto' → montoTotal · 'rango' → montoMin..montoTotal ·
 * 'desconocido' → todavía no lo sabe · null → nunca se preguntó.
 */
export type ModoMonto = 'exacto' | 'rango' | 'desconocido';

export type Objetivo = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'individual' | 'grupal';
  moneda: Moneda;
  horizonte: string | null;
  modoMonto: ModoMonto | null;
  /** null = "todavía no sé cuánto" — se muestra como por-descubrir, no como 0 */
  montoTotal: number | null;
  /** Sólo cuando modoMonto === 'rango'. */
  montoMin: number | null;
  estado: 'active' | 'achieved' | 'cancelled';
  /**
   * 'ahorro' = un objetivo; 'gasto' = algo que ya se sabe que se va a pagar
   * (migración 0043 de Mis planes). Mientras Mis planes no esté en producción
   * no viene: todo objetivo es de ahorro.
   */
  clase?: 'ahorro' | 'gasto';
  /** Sólo en los gastos: si se repite cada semana o cada mes. */
  repite?: 'mensual' | 'semanal' | null;
  contribuciones: Contribucion[];
};

export type PerfilInversor = {
  porQue: string | null;
  reaccion: string | null;
  yaInvierte: boolean | null;
  enQue: string[];
  bancos: string[];
  /**
   * Cuándo terminó el quiz completo. null = todavía no.
   * No alcanza con que el perfil exista: las dos preguntas del onboarding ya
   * lo crean, y quien sólo pasó por ahí tiene que seguir el quiz donde quedó.
   */
  completadoEn: string | null;
};

export type AporteInversion = {
  id: string;
  instrumento: string;
  monto: number;
  /** Los instrumentos de FINA se valúan en pesos o dólares. */
  moneda: MonedaConvertible;
  montoArs: number;
  cotizacion: number | null;
  ts: number;
};

/** Los tipos de inversión que se pueden registrar con sus datos específicos (migración 0039). */
export type TipoPosicion =
  | 'cuenta_remunerada'
  | 'fci'
  | 'plazo_fijo'
  | 'plazo_fijo_uva'
  | 'letra'
  | 'bono_cer'
  | 'dolar'
  | 'cedear';

/**
 * Una inversión registrada con lo que la persona ve en su app: dónde está, a
 * qué tasa, hasta cuándo. A diferencia de `AporteInversion` (sólo "cuánto y en
 * qué"), esto permite avisar un vencimiento o decir si le está ganando a la
 * inflación.
 */
export type PosicionInversion = {
  id: string;
  tipo: TipoPosicion;
  /** Dónde está: 'Mercado Pago', 'Cocos Capital', el banco… */
  proveedor: string;
  /** Pesos puestos. En un dólar o un CEDEAR, lo que costó en pesos. */
  monto: number;
  /** 'YYYY-MM-DD' */
  inicio: string;
  vencimiento: string | null;
  plazoDias: number | null;
  /** Tasa nominal anual como fracción (0.21 = 21%), tal como la ve la persona. */
  tna: number | null;
  /** Cuotapartes, CEDEARs, letras o dólares comprados. */
  cantidad: number | null;
  precioUnitario: number | null;
  /** Lo propio de cada tipo: fondo y clase, ticker, tipo de dólar, renovación… */
  detalle: Record<string, string | number | boolean | null>;
  estado: 'activa' | 'cerrada';
  /** 'captura' = lo leímos de una captura y la persona lo confirmó. */
  origen: 'manual' | 'captura';
  ts: number;
};

export type MiembroGrupo = {
  userId: string;
  nombre: string;
  actividad: number;
  rol: 'owner' | 'member';
  sosVos: boolean;
};

export type Grupo = {
  id: string;
  nombre: string;
  codigo: string;
  miembros: MiembroGrupo[];
};

export type Perfil = {
  nombre: string;
  genero: string | null;
  generoOtro: string | null;
  rangoEdad: string | null;
  zona: string | null;
  convivencia: string[];
  ingresos: string[];
  estabilidadIngresos: string | null;
  metaPrincipal: string | null;
  comoConocio: string | null;
  nivelFinanciero: string | null;
  reserva: number;
  telefono: string | null;
  terminosAceptadosEn: string | null;
  /**
   * Las respuestas del onboarding que se leen en bloque y nunca se filtran
   * (cómo viene el mes, gastos fijos, qué recortaría, etc.). Van juntas en un
   * jsonb porque el cuestionario cambia seguido: ver la migración 0024.
   */
  onboarding: Record<string, unknown> | null;
  /** URL pública de la foto de perfil, o null. Se sube con `subirFoto`. */
  fotoUrl: string | null;
  /**
   * Cuándo se probó que el teléfono es suyo, o null si es sólo declarado.
   * Se verifica mandándole un código al bot de WhatsApp (migración 0026).
   */
  telefonoVerificadoEn: string | null;
};

// ── El paso del día y la racha (migración 0028) ─────────────────────────
export type PasoGuardado = {
  /** 'YYYY-MM-DD', el día en Argentina. */
  dia: string;
  /** Clave del catálogo de api/v2/pasos.ts. */
  clave: string;
  /** Cuándo se detectó cumplido, o null si todavía no. */
  cumplidoEn: string | null;
  /** Si el paso lo eligió la IA, el mensaje que escribió para esta persona. */
  mensaje: string | null;
};

export type DiaDeRacha = {
  dia: string;
  /**
   * 'gasto' = anotó un gasto en la app · 'whatsapp' = le contó un gasto al bot ·
   * 'comodin' = el comodín salvó el día · 'paso' = cumplió el paso del día (sólo
   * en los días anteriores a la migración 0044).
   */
  tipo: 'gasto' | 'whatsapp' | 'comodin' | 'paso';
  paso?: string;
};

export type Racha = {
  dias: number;
  hoyCumplido: boolean;
  /** Si el comodín de esta semana todavía está libre. */
  comodinDisponible: boolean;
  /** Del día más reciente al más viejo. */
  detalle: DiaDeRacha[];
};

export const RACHA_VACIA: Racha = { dias: 0, hoyCumplido: false, comodinDisponible: true, detalle: [] };

/** Todo lo que la app necesita de una usuaria, en una sola carga. */
export type EstadoV2 = {
  perfil: Perfil;
  secciones: Seccion[];
  mediosPago: MedioPago[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  cargas: Carga[];
  gastosFijos: GastoFijo[];
  /** Pesos por dólar, para pasar registros de una moneda a otra. */
  dolar: number | null;
  objetivos: Objetivo[];
  perfilInversor: PerfilInversor | null;
  aportes: AporteInversion[];
  /** Inversiones registradas con sus datos específicos. Vacío si todavía no se corrió la migración 0039. */
  posiciones: PosicionInversion[];
  grupo: Grupo | null;
};

export const PERFIL_VACIO: Perfil = {
  nombre: '',
  genero: null,
  generoOtro: null,
  rangoEdad: null,
  zona: null,
  convivencia: [],
  ingresos: [],
  estabilidadIngresos: null,
  metaPrincipal: null,
  comoConocio: null,
  nivelFinanciero: null,
  reserva: 0,
  telefono: null,
  terminosAceptadosEn: null,
  onboarding: null,
  fotoUrl: null,
  telefonoVerificadoEn: null,
};

export const ESTADO_VACIO: EstadoV2 = {
  perfil: PERFIL_VACIO,
  secciones: [],
  mediosPago: [],
  gastos: [],
  ingresos: [],
  cargas: [],
  gastosFijos: [],
  dolar: null,
  objetivos: [],
  perfilInversor: null,
  aportes: [],
  posiciones: [],
  grupo: null,
};

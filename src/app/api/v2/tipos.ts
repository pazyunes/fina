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
export type TipoGasto = 'necesario' | 'urgente' | 'impulsivo' | 'otro';
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

export type Gasto = {
  id: string;
  monto: number;
  /** Un gasto siempre entra al total en pesos, así que su moneda se convierte. */
  moneda: MonedaConvertible;
  descripcion: string;
  seccionId: string | null;
  tipo: TipoGasto;
  metodoPago: string | null;
  grupoId: string | null;
  ts: number;
  /** 'web' = cargado en la app · 'whatsapp' = cargado por el bot */
  origen: 'web' | 'whatsapp' | 'manual';
};

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
};

/** Todo lo que la app necesita de una usuaria, en una sola carga. */
export type EstadoV2 = {
  perfil: Perfil;
  secciones: Seccion[];
  mediosPago: MedioPago[];
  gastos: Gasto[];
  objetivos: Objetivo[];
  perfilInversor: PerfilInversor | null;
  aportes: AporteInversion[];
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
};

export const ESTADO_VACIO: EstadoV2 = {
  perfil: PERFIL_VACIO,
  secciones: [],
  mediosPago: [],
  gastos: [],
  objetivos: [],
  perfilInversor: null,
  aportes: [],
  grupo: null,
};

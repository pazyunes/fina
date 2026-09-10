// Contrato de datos del flujo v2. Es la única definición de estas formas: los
// componentes no vuelven a declararlas (§9 de la guía — los tipos compartidos
// viven en la capa de API porque son el contrato con el backend).

export type Moneda = 'ARS' | 'USD';
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
  moneda: Moneda;
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
  montoArs: number;
  kind: KindAporte;
  label: string | null;
  ts: number;
};

export type Objetivo = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'individual' | 'grupal';
  moneda: Moneda;
  horizonte: string | null;
  /** null = "todavía no sé cuánto" — se muestra como por-descubrir, no como 0 */
  montoTotal: number | null;
  estado: 'active' | 'achieved' | 'cancelled';
  contribuciones: Contribucion[];
};

export type PerfilInversor = {
  porQue: string | null;
  reaccion: string | null;
  yaInvierte: boolean | null;
  enQue: string[];
  bancos: string[];
};

export type AporteInversion = {
  id: string;
  instrumento: string;
  monto: number;
  moneda: Moneda;
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

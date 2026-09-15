import type { EstadoV2 } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// El paso del día: el catálogo, a quién le toca cuál, y cuándo está cumplido.
//
// Un paso por día, distinto cada día, y cumplirlo suma a la racha. El motivo
// para volver mañana es que mañana toca otro.
//
// NO HAY BOTÓN DE "LISTO". Cada paso sabe mirar los datos y darse cuenta solo
// de que se cumplió: "registrá un gasto" se cumple cuando hay un gasto de hoy.
// Con un botón la racha se inflaría tocándolo y dejaría de medir algo real.
//
// Por eso en el catálogo sólo entran pasos que se pueden VERIFICAR. "Agregá
// plata disponible" quedó afuera: el único rastro es la fecha de último uso
// del medio de pago, y esa fecha también la toca registrar un gasto, así que
// no se puede distinguir una cosa de la otra.
// ─────────────────────────────────────────────────────────────────────────

export type ClavePaso =
  | 'primer_gasto' | 'verificar_telefono' | 'tope' | 'perfil_inversor' | 'nivel_financiero' | 'grupo'
  | 'gasto_hoy' | 'gasto_whatsapp' | 'aporte_objetivo' | 'aporte_inversion';

/** Lo que la pantalla de destino abre al llegar desde "Tu paso de hoy". */
export type AccionPaso = 'gasto' | 'tope' | 'verificar' | 'quiz' | 'nivel' | 'grupo' | 'aporte_objetivo' | 'aporte';

export type Paso = {
  clave: ClavePaso;
  /** 'una' = se hace una sola vez · 'diaria' = se puede repetir */
  vez: 'una' | 'diaria';
  titulo: string;
  msg: string;
  cta: string;
  /** Ruta de la app, o 'whatsapp' para abrir el bot. */
  destino: string;
  /**
   * Qué abrir al llegar, para que el botón lleve directo a hacer el paso y no
   * a la pantalla general. Viaja en el `state` de la navegación (ver
   * onboarding-v2/alLlegar.ts).
   */
  abrir?: AccionPaso;
  /** Si se le puede asignar a esta persona hoy. */
  aplica: (e: EstadoV2) => boolean;
  /** Si ya está cumplido, mirando los datos. */
  cumplido: (e: EstadoV2, hoy: string) => boolean;
};

// ── El día, en Argentina ─────────────────────────────────────────────────
// El mismo criterio que la migración 0028. Con el día de UTC, un paso cumplido
// a las 22 hs contaría para mañana y la racha se cortaría sola.
const ZONA = 'America/Argentina/Buenos_Aires';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' del día en Argentina para un instante (por defecto, ahora). */
export function diaArgentina(ts: number = Date.now()): string {
  return formato.format(new Date(ts));
}

/** El día anterior a uno dado, en 'YYYY-MM-DD'. */
export function diaAnterior(dia: string): string {
  // Mediodía para esquivar cualquier salto de horario: restar 24 hs a la
  // medianoche puede caer en el día equivocado si la zona cambia de hora.
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const esHoy = (ts: number, hoy: string) => diaArgentina(ts) === hoy;

// ── El catálogo ──────────────────────────────────────────────────────────
// El orden de los de "una vez" es la prioridad: primero lo que destraba más
// cosas. Verificar el teléfono va segundo porque sin eso no funciona el bot,
// que es la mejor forma de sostener la racha.
export const PASOS: Paso[] = [
  {
    clave: 'primer_gasto', vez: 'una',
    titulo: 'Registrá tu primer gasto',
    msg: 'Con eso ya te armamos tus secciones y tu análisis solo.',
    cta: 'Registrar un gasto', destino: '/onboarding-v2/gastos', abrir: 'gasto',
    aplica: (e) => e.gastos.length === 0,
    cumplido: (e) => e.gastos.length > 0,
  },
  {
    clave: 'verificar_telefono', vez: 'una',
    titulo: 'Verificá tu teléfono',
    msg: 'Así podés contarle tus gastos a FINA por WhatsApp, sin abrir la app.',
    cta: 'Verificar ahora', destino: '/onboarding-v2/perfil', abrir: 'verificar',
    aplica: (e) => !e.perfil.telefonoVerificadoEn,
    cumplido: (e) => !!e.perfil.telefonoVerificadoEn,
  },
  {
    clave: 'tope', vez: 'una',
    titulo: 'Ponéle un tope a una sección',
    msg: 'Elegí la que más se te va y decidí hasta cuánto. No es una prohibición: es un aviso.',
    cta: 'Poner un tope', destino: '/onboarding-v2/gastos', abrir: 'tope',
    aplica: (e) => e.secciones.length > 0 && !e.secciones.some((s) => s.tope !== null),
    cumplido: (e) => e.secciones.some((s) => s.tope !== null),
  },
  {
    clave: 'perfil_inversor', vez: 'una',
    titulo: 'Averiguá tu perfil de inversor',
    msg: 'Son dos minutos, y las recomendaciones pasan a tener que ver con vos.',
    cta: 'Armar mi perfil', destino: '/onboarding-v2/inversiones', abrir: 'quiz',
    aplica: (e) => !e.perfilInversor?.completadoEn,
    cumplido: (e) => !!e.perfilInversor?.completadoEn,
  },
  {
    clave: 'nivel_financiero', vez: 'una',
    titulo: 'Descubrí tu nivel financiero',
    msg: 'Una pregunta, y te explicamos las cosas a tu medida.',
    cta: 'Descubrirlo', destino: '/onboarding-v2/perfil', abrir: 'nivel',
    aplica: (e) => !e.perfil.nivelFinanciero,
    cumplido: (e) => !!e.perfil.nivelFinanciero,
  },
  {
    clave: 'grupo', vez: 'una',
    titulo: 'Armá un grupo con amigas',
    msg: 'Compiten por quién registra más. Nadie ve cuánto gastás.',
    cta: 'Armar un grupo', destino: '/onboarding-v2/grupos', abrir: 'grupo',
    aplica: (e) => e.grupo === null,
    cumplido: (e) => e.grupo !== null,
  },

  {
    clave: 'gasto_hoy', vez: 'diaria',
    titulo: 'Registrá un gasto de hoy',
    msg: 'Aunque sea el café. Lo que no se anota, no se ve.',
    cta: 'Registrar un gasto', destino: '/onboarding-v2/gastos', abrir: 'gasto',
    aplica: () => true,
    cumplido: (e, hoy) => e.gastos.some((g) => esHoy(g.ts, hoy)),
  },
  {
    clave: 'gasto_whatsapp', vez: 'diaria',
    titulo: 'Contale un gasto a FINA por WhatsApp',
    msg: 'Escribile como a una amiga: "gasté 5.000 en el súper". Ella lo anota.',
    cta: 'Abrir WhatsApp', destino: 'whatsapp',
    // Sólo si el teléfono está verificado: si no, el bot no la reconoce y el
    // paso sería imposible de cumplir.
    aplica: (e) => !!e.perfil.telefonoVerificadoEn,
    cumplido: (e, hoy) => e.gastos.some((g) => g.origen === 'whatsapp' && esHoy(g.ts, hoy)),
  },
  {
    clave: 'aporte_objetivo', vez: 'diaria',
    titulo: 'Sumale algo a tu objetivo',
    msg: 'No importa cuánto. Lo que importa es que avance.',
    cta: 'Sumarle a mi objetivo', destino: '/onboarding-v2/objetivos', abrir: 'aporte_objetivo',
    aplica: (e) => e.objetivos.some((o) => o.estado === 'active'),
    cumplido: (e, hoy) => e.objetivos.some((o) => o.contribuciones.some((c) => esHoy(c.ts, hoy))),
  },
  {
    clave: 'aporte_inversion', vez: 'diaria',
    titulo: 'Anotá un aporte a tus inversiones',
    msg: 'Si pusiste plata en algún lado, anotala y seguí cómo evoluciona.',
    cta: 'Registrar un aporte', destino: '/onboarding-v2/inversiones', abrir: 'aporte',
    aplica: (e) => !!e.perfilInversor?.completadoEn,
    cumplido: (e, hoy) => e.aportes.some((a) => esHoy(a.ts, hoy)),
  },
];

export function pasoPorClave(clave: string): Paso | undefined {
  return PASOS.find((p) => p.clave === clave);
}

// ── A quién le toca cuál ─────────────────────────────────────────────────
/**
 * Elige el paso de hoy.
 *
 * · Sin gastos, el primero siempre es registrar uno: es el hábito que sostiene
 *   todo lo demás.
 * · Después alterna por día entre un paso de "una vez" pendiente y uno diario.
 *   Poner todos los de una vez primero serían seis días de trámites antes de
 *   tocar el hábito; alternar mantiene la variedad y arma la costumbre desde
 *   el principio.
 * · Nunca repite el de ayer: "distinto cada día" es la regla.
 * · Sólo elige pasos que la persona pueda cumplir hoy.
 *
 * Es determinística: los mismos datos y el mismo día dan el mismo paso. No es
 * lo que garantiza que no cambie en el día — eso lo garantiza que se guarda —
 * pero hace que dos dispositivos que eligen a la vez elijan lo mismo.
 */
export function elegirPaso(e: EstadoV2, hoy: string, claveDeAyer: string | null): ClavePaso {
  const primer = pasoPorClave('primer_gasto')!;
  if (primer.aplica(e) && claveDeAyer !== 'primer_gasto') return 'primer_gasto';

  const noAyer = (p: Paso) => p.clave !== claveDeAyer;
  const unaVez = PASOS.filter((p) => p.vez === 'una' && p.clave !== 'primer_gasto' && p.aplica(e) && noAyer(p));
  const diarios = PASOS.filter((p) => p.vez === 'diaria' && p.aplica(e) && noAyer(p));

  // Número de día para alternar y rotar. Días desde 1970, en Argentina.
  const n = Math.floor(new Date(`${hoy}T12:00:00Z`).getTime() / 86_400_000);
  const tocaUnaVez = n % 2 === 0;

  const primero = tocaUnaVez ? unaVez : diarios;
  const segundo = tocaUnaVez ? diarios : unaVez;

  // Los de una vez van por prioridad (el orden del catálogo); los diarios rotan.
  if (primero.length > 0) return (tocaUnaVez ? primero[0] : primero[n % primero.length]).clave;
  if (segundo.length > 0) return (tocaUnaVez ? segundo[n % segundo.length] : segundo[0]).clave;
  return 'gasto_hoy';
}

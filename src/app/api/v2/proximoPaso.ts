import type { EstadoV2 } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// El próximo paso: UN paso grande, de los que cambian la situación de la
// persona y no se hacen en un minuto (abrir una cuenta donde la plata rinda,
// hacer la primera inversión). Queda en Inicio hasta que la persona marca que
// lo hizo, porque pasan afuera de la app y FINA no los puede ver.
//
// Reemplaza al paso del día (pasos.ts), que cambiaba todos los días. Registrar
// lo del día quedó como recordatorio fijo y es lo que sostiene la racha.
//
// CUÁL TOCA. No hay un orden fijo para todo el mundo (regla 11): cada paso dice
// si aplica y cuánto, con los datos de la persona. Gana el de más puntaje entre
// los que aplican y no hizo. Algunos se dan por hechos solos cuando los datos
// lo muestran (si ya registró aportes, ya hizo su primera inversión).
// ─────────────────────────────────────────────────────────────────────────

export type ClaveProximoPaso = 'cuenta_que_rinda' | 'ordenar_deudas' | 'ahorro_automatico' | 'primera_inversion' | 'diversificar';

export type ProximoPaso = {
  clave: ClaveProximoPaso;
  titulo: string;
  /** Por qué le toca a esta persona, con sus datos cuando los hay. */
  porQue: string;
  /** Cómo se hace, en pocas líneas. Se abre si la persona lo pide. */
  comoHacerlo: string[];
  /** Si una parte se hace en la app: a dónde lleva y qué dice el botón. */
  enLaApp?: { cta: string; destino: string; abrir?: 'quiz' | 'aporte' };
};

const INVERSIONES = '/onboarding-v2/inversiones';
const DIA_MS = 86_400_000;

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

type Def = {
  clave: ClaveProximoPaso;
  /** null = no aplica a esta persona. Si aplica, cuánto le sirve ahora. */
  puntaje: (e: EstadoV2, marcados: ReadonlySet<string>) => number | null;
  /** true si los datos ya muestran que lo hizo, aunque no lo haya marcado. */
  hechoSolo?: (e: EstadoV2) => boolean;
  armar: (e: EstadoV2) => Omit<ProximoPaso, 'clave'>;
};

/** Instrumentos distintos en los que invierte: lo que registró, o lo que contó en el quiz. */
function instrumentos(e: EstadoV2): number {
  const registrados = new Set(e.aportes.map((a) => a.instrumento)).size;
  return Math.max(registrados, e.perfilInversor?.enQue.length ?? 0);
}
const invierte = (e: EstadoV2) => e.aportes.length > 0 || e.perfilInversor?.yaInvierte === true;

/** Lo pagado con tarjeta de crédito en los últimos 30 días, en pesos. */
function pagadoConCredito(e: EstadoV2): number {
  const desde = Date.now() - 30 * DIA_MS;
  const esCredito = (medio: string | null | undefined) => !!medio && /cr[eé]dito|tarjeta/i.test(medio);
  let total = 0;
  for (const g of e.gastos) {
    if (g.ts < desde) continue;
    if (g.pagos?.length) for (const p of g.pagos) { if (esCredito(p.medio)) total += p.monto; }
    else if (esCredito(g.metodoPago)) total += g.montoArs;
  }
  return total;
}

const DEFS: Def[] = [
  {
    clave: 'cuenta_que_rinda',
    // Con plata apartada, cada día que pasa quieta es lo que más se pierde.
    puntaje: (e) => 50 + (e.perfil.reserva > 0 ? 30 : 0),
    armar: (e) => ({
      titulo: 'Abrí una cuenta para hacer rendir tu plata',
      porQue: e.perfil.reserva > 0
        ? `Tenés ${pesos(e.perfil.reserva)} apartados. Si no están en una cuenta remunerada, ahí sumarían intereses todos los días.`
        : 'Con inflación, la plata quieta en una caja de ahorro suele comprar menos cada mes. Una cuenta remunerada le suma intereses todos los días.',
      comoHacerlo: [
        'Elegí un banco digital o una billetera virtual con cuenta remunerada.',
        'Abrila desde el celular con tu DNI: lleva unos minutos.',
        'Pasá ahí la plata que no vas a usar esta semana.',
      ],
    }),
  },
  {
    clave: 'ordenar_deudas',
    // Si viene pagando con crédito, es lo primero: los intereses le ganan a
    // cualquier inversión.
    puntaje: (e) => 40 + (pagadoConCredito(e) > 0 ? 45 : 0),
    armar: (e) => {
      const credito = pagadoConCredito(e);
      return {
        titulo: 'Ordená tus cuotas y préstamos',
        porQue: credito > 0
          ? `En los últimos 30 días pagaste ${pesos(credito)} con tarjeta. Las cuotas con interés y los préstamos rápidos suelen costar más de lo que rinde una cuenta remunerada o un plazo fijo.`
          : 'Las cuotas con interés, el pago mínimo de la tarjeta y los préstamos rápidos suelen costar más de lo que rinde una cuenta remunerada o un plazo fijo.',
        comoHacerlo: [
          'Anotá qué cuotas y préstamos tenés y cuánto pagás por mes.',
          'Pagá el total de la tarjeta, no el mínimo, cuando puedas.',
          'Antes de un préstamo, mirá el CFT: es lo que de verdad terminás pagando.',
        ],
      };
    },
  },
  {
    clave: 'ahorro_automatico',
    puntaje: (e) => 35 + (e.ingresos.length > 0 ? 20 : 0),
    armar: () => ({
      titulo: 'Apartá un ahorro apenas cobrás',
      porQue: 'Apartar un monto fijo el mismo día que cobrás funciona mejor que esperar a ver qué sobra a fin de mes.',
      comoHacerlo: [
        'Elegí un monto que no te complique, aunque sea chico.',
        'Programá una transferencia automática para el día que cobrás.',
        'Mandala a una cuenta aparte, así no la mezclás con la del día a día.',
      ],
    }),
  },
  {
    clave: 'primera_inversion',
    puntaje: (e) => (invierte(e) ? null : 30 + (e.perfil.reserva > 0 ? 15 : 0)),
    hechoSolo: invierte,
    armar: (e) => ({
      titulo: 'Hacé tu primera inversión',
      porQue: e.perfil.reserva > 0
        ? `Tenés ${pesos(e.perfil.reserva)} apartados: con una parte ya podés empezar.`
        : 'Se puede empezar con montos chicos.',
      comoHacerlo: [
        'Hacé el perfil de inversor en FINA para saber qué te conviene.',
        'Empezá con un monto chico en un instrumento simple.',
        'Registralo en Inversiones para seguir cómo va.',
      ],
      enLaApp: { cta: 'Armar mi perfil de inversor', destino: INVERSIONES, abrir: 'quiz' },
    }),
  },
  {
    clave: 'diversificar',
    // Para quien ya invierte (o marcó su primera inversión) en una sola cosa.
    puntaje: (e, marcados) => ((invierte(e) || marcados.has('primera_inversion')) && instrumentos(e) <= 1 ? 45 : null),
    hechoSolo: (e) => instrumentos(e) >= 2,
    armar: (e) => {
      const unico = e.aportes[0]?.instrumento ?? e.perfilInversor?.enQue[0] ?? null;
      return {
        titulo: 'Diversificá tus inversiones',
        porQue: unico
          ? `Hoy tenés todo en ${unico}. Repartí entre dos o tres instrumentos distintos: si a uno le va mal, no te afecta todo.`
          : 'Repartí entre dos o tres instrumentos distintos: si a uno le va mal, no te afecta todo.',
        comoHacerlo: [
          'Sumá un instrumento distinto al que ya tenés (otro plazo, otra moneda u otro riesgo).',
          'No hace falta mover todo: empezá con lo que vayas a invertir de ahora en más.',
          'Registralo en Inversiones para ver cómo se reparte.',
        ],
        enLaApp: { cta: 'Registrar una inversión', destino: INVERSIONES, abrir: 'aporte' },
      };
    },
  },
];

/** Si un paso ya está hecho: marcado por la persona, o visible en los datos. */
export function estaHecho(e: EstadoV2, clave: ClaveProximoPaso, marcados: ReadonlySet<string>): boolean {
  if (marcados.has(clave)) return true;
  return DEFS.find((d) => d.clave === clave)?.hechoSolo?.(e) ?? false;
}

/** El próximo paso de esta persona, o null si hizo todos los que le aplican. */
export function elegirProximoPaso(e: EstadoV2, marcados: ReadonlySet<string>): ProximoPaso | null {
  let mejor: { def: Def; puntaje: number } | null = null;
  for (const def of DEFS) {
    if (estaHecho(e, def.clave, marcados)) continue;
    const p = def.puntaje(e, marcados);
    if (p === null) continue;
    if (!mejor || p > mejor.puntaje) mejor = { def, puntaje: p };
  }
  return mejor ? { clave: mejor.def.clave, ...mejor.def.armar(e) } : null;
}

export type PasoEnProgreso = { clave: ClaveProximoPaso; titulo: string; hecho: boolean };

/**
 * Todos los pasos grandes, para la pantalla de progreso: primero los hechos y
 * después los que faltan, en el orden en que le van a tocar.
 */
export function todosLosPasos(e: EstadoV2, marcados: ReadonlySet<string>): PasoEnProgreso[] {
  const filas = DEFS.map((d) => ({ clave: d.clave, titulo: d.armar(e).titulo, hecho: estaHecho(e, d.clave, marcados), puntaje: d.puntaje(e, marcados) ?? -1 }));
  return [...filas.filter((f) => f.hecho), ...filas.filter((f) => !f.hecho).sort((a, b) => b.puntaje - a.puntaje)]
    .map(({ clave, titulo, hecho }) => ({ clave, titulo, hecho }));
}

/** Cuántos pasos hizo, de los que existen: para decir "Hiciste 2 de 5". */
export function pasosHechos(e: EstadoV2, marcados: ReadonlySet<string>): { hechos: number; total: number } {
  return { hechos: DEFS.filter((d) => estaHecho(e, d.clave, marcados)).length, total: DEFS.length };
}

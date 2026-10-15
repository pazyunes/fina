import type { EstadoV2, Objetivo } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// El paso del día: el catálogo, a quién le toca cuál, y cuándo está cumplido.
//
// Un paso por día, elegido con los datos de la persona, y cumplirlo suma a la
// racha. El motivo para volver mañana es que mañana toca otro.
//
// NO HAY BOTÓN DE "LISTO". Cada paso sabe mirar los datos y darse cuenta solo
// de que se cumplió: "ponele un tope a Delivery" se cumple cuando Delivery
// tiene tope. Con un botón la racha se inflaría tocándolo y dejaría de medir
// algo real. Los pasos de revisión (comparar el mes con el anterior) se cumplen
// contestando una pregunta sobre los números que se muestran, como el del
// nivel financiero.
//
// PASOS CON NOMBRE. Muchos pasos son sobre algo puntual de la persona (una
// sección, un objetivo, un gasto fijo). La clave guardada lleva ese algo:
// 'tope_seccion:<id de la sección>'. El título se arma con el nombre cuando hay
// datos para buscarlo ("Ponele un tope a Delivery") y, si no, queda uno general
// ("Ponele un tope a una sección").
//
// NIVELES. Los pasos se destraban con la experiencia (días con actividad o
// racha): 1 lo básico, 2 ordenar, 3 mejorar. Los de nivel más bajo siguen
// disponibles; se prefieren los del nivel recién destrabado.
//
// Registrar el gasto del día YA NO ES UN PASO (salvo el primero de todos): es
// un recordatorio fijo en Home y un aviso a la tarde. Un paso que se repite
// todos los días no le enseña nada nuevo a nadie.
//
// Este archivo lo importan también las funciones del servidor (api/), así que
// no puede importar nada del navegador: sólo tipos.
// ─────────────────────────────────────────────────────────────────────────

export type BasePaso =
  // Nivel 1: lo básico
  | 'primer_gasto' | 'verificar_telefono' | 'nivel_financiero' | 'ingreso_mes' | 'primer_objetivo' | 'fijo_cerca'
  // Nivel 2: ordenar
  | 'tope_seccion' | 'aporte_objetivo' | 'monto_objetivo' | 'cargar_fijo' | 'perfil_inversor' | 'grupo' | 'aporte_inversion'
  // Nivel 3: mejorar
  | 'separar_ingreso' | 'ajustar_tope' | 'revisar_mes' | 'comparar_seccion'
  // Viejos: ya no entran en la rotación, pero pueden estar guardados en la
  // racha de días anteriores (o en el de hoy, si se asignó antes del cambio).
  | 'tope' | 'gasto_hoy' | 'gasto_whatsapp';

/** La clave guardada: la base, y si el paso es sobre algo puntual, sus datos ('tope_seccion:<id>'). */
export type ClavePaso = string;

export type Nivel = 1 | 2 | 3;

/** Lo que la pantalla de destino abre al llegar desde "Tu paso de hoy". */
export type AccionPaso = 'gasto' | 'tope' | 'verificar' | 'quiz' | 'nivel' | 'grupo' | 'aporte_objetivo' | 'aporte' | 'fijos';

/** Los pasos que se hacen en Home mirando una comparación. */
export type Revision = 'mes' | 'seccion';

export type Paso = {
  clave: ClavePaso;
  base: BasePaso;
  nivel: Nivel;
  /** 'una' = se hace una sola vez · 'diaria' = se puede repetir */
  vez: 'una' | 'diaria';
  titulo: string;
  msg: string;
  cta: string;
  /** Ruta de la app, 'whatsapp' para abrir el bot, o 'revision' para comparar en Home. */
  destino: string;
  /**
   * Qué abrir al llegar, para que el botón lleve directo a hacer el paso y no
   * a la pantalla general. Viaja en el `state` de la navegación (ver
   * onboarding-v2/alLlegar.ts), junto con `ref`.
   */
  abrir?: AccionPaso;
  /** El id de la sección, objetivo o gasto fijo del que habla el paso, si habla de uno. */
  ref: string | null;
  revision?: Revision;
};

// ── El día, en Argentina ─────────────────────────────────────────────────
// El mismo criterio que la migración 0028. Con el día de UTC, un paso cumplido
// a las 22 hs contaría para mañana y la racha se cortaría sola.
const ZONA = 'America/Argentina/Buenos_Aires';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const DIA_MS = 86_400_000;

/** 'YYYY-MM-DD' del día en Argentina para un instante (por defecto, ahora). */
export function diaArgentina(ts: number = Date.now()): string {
  return formato.format(new Date(ts));
}

/** Un día más `n` días, en 'YYYY-MM-DD'. */
export function sumarDiasAR(dia: string, n: number): string {
  // Mediodía para esquivar cualquier salto de horario: restar 24 hs a la
  // medianoche puede caer en el día equivocado si la zona cambia de hora.
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** El día anterior a uno dado, en 'YYYY-MM-DD'. */
export function diaAnterior(dia: string): string {
  return sumarDiasAR(dia, -1);
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);
const tsDe = (dia: string) => Date.parse(`${dia}T12:00:00-03:00`);
const esHoy = (ts: number, hoy: string) => diaArgentina(ts) === hoy;
const inicioDeMes = (dia: string) => `${dia.slice(0, 7)}-01`;

/** El mismo día del mes anterior (o el último, si el mes anterior es más corto). */
function mismoDiaMesAnterior(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const anterior = new Date(Date.UTC(a, m - 2, 1, 12));
  const ultimo = new Date(Date.UTC(anterior.getUTCFullYear(), anterior.getUTCMonth() + 1, 0)).getUTCDate();
  anterior.setUTCDate(Math.min(d, ultimo));
  return anterior.toISOString().slice(0, 10);
}

// ── Cuentas que usan los pasos (y la pantalla de revisión) ───────────────

export type Comparacion = {
  /** Gastado desde el 1 del mes hasta hoy, en pesos. */
  esteMes: number;
  /** Gastado en los mismos días del mes pasado, en pesos. */
  mismosDiasMesPasado: number;
  cantidadEsteMes: number;
  cantidadMesPasado: number;
  diaDelMes: number;
};

/**
 * El mes en curso contra los MISMOS días del mes pasado, de toda la plata o de
 * una sección. Nunca contra el mes pasado entero: 14 días contra 30 harían
 * parecer que este mes se gasta la mitad.
 */
export function compararConMesPasado(e: EstadoV2, hoy: string, seccionId: string | null = null): Comparacion {
  const desde = inicioDeMes(hoy);
  const hastaPasado = mismoDiaMesAnterior(hoy);
  const desdePasado = inicioDeMes(hastaPasado);
  const r: Comparacion = { esteMes: 0, mismosDiasMesPasado: 0, cantidadEsteMes: 0, cantidadMesPasado: 0, diaDelMes: Number(hoy.slice(8, 10)) };
  for (const g of e.gastos) {
    if (seccionId !== null && g.seccionId !== seccionId) continue;
    const d = diaArgentina(g.ts);
    if (d >= desde && d <= hoy) { r.esteMes += g.montoArs; r.cantidadEsteMes++; } else if (d >= desdePasado && d <= hastaPasado) { r.mismosDiasMesPasado += g.montoArs; r.cantidadMesPasado++; }
  }
  return r;
}

function ultimoAporte(o: Objetivo): number | null {
  return o.contribuciones.length ? Math.max(...o.contribuciones.map((c) => c.ts)) : null;
}

function primerDia(e: EstadoV2): string | null {
  if (e.gastos.length === 0) return null;
  return diaArgentina(Math.min(...e.gastos.map((g) => g.ts)));
}

/**
 * Experiencia: días distintos con algo registrado (gastos, ingresos, aportes), o
 * la racha si es más larga. Destraba los niveles: 1 lo básico, 2 ordenar
 * (desde 5 días), 3 mejorar (desde 15).
 */
export function nivelDe(e: EstadoV2, racha = 0): Nivel {
  const dias = new Set<string>();
  for (const g of e.gastos) dias.add(diaArgentina(g.ts));
  for (const i of e.ingresos) dias.add(diaArgentina(i.ts));
  for (const o of e.objetivos) for (const c of o.contribuciones) dias.add(diaArgentina(c.ts));
  const experiencia = Math.max(dias.size, racha);
  return experiencia >= 15 ? 3 : experiencia >= 5 ? 2 : 1;
}

// ── El catálogo ──────────────────────────────────────────────────────────

type Entidad = 'seccion' | 'objetivo' | 'fijo';

/** Cómo encontrar el nombre de lo que habla un paso. En la app sale del estado; en el servidor, de la base. */
export type Nombres = Partial<Record<Entidad, (id: string) => string | undefined>>;

type Candidato = { params: string[]; puntaje: number };

type Def = {
  base: BasePaso;
  nivel: Nivel;
  vez: 'una' | 'diaria';
  /** false = no se elige nunca (el primer gasto lo decide la regla; los viejos ya no van). */
  enRotacion: boolean;
  /** Si el primer dato de la clave es el id de una sección, un objetivo o un gasto fijo. */
  entidad?: Entidad;
  /** El título, con el nombre de la entidad si se conoce. */
  titulo: (nombre: string | null) => string;
  msg: string;
  cta: string;
  destino: string;
  abrir?: AccionPaso;
  revision?: Revision;
  /** Las versiones de este paso que le sirven hoy a la persona, con cuánto le sirven. */
  candidatos: (e: EstadoV2, hoy: string) => Candidato[];
  /** Si ya está cumplido, mirando los datos. */
  cumplido: (e: EstadoV2, hoy: string, params: string[]) => boolean;
};

const GASTOS = '/onboarding-v2/gastos';
const OBJETIVOS = '/onboarding-v2/objetivos';
const PERFIL = '/onboarding-v2/perfil';
const INVERSIONES = '/onboarding-v2/inversiones';
const GRUPOS = '/onboarding-v2/grupos';

const uno = (puntaje: number): Candidato[] => [{ params: [], puntaje }];
const ninguno: Candidato[] = [];
const aporteHoy = (e: EstadoV2, hoy: string, objetivoId?: string) =>
  e.objetivos.some((o) => (!objetivoId || o.id === objetivoId) && o.contribuciones.some((c) => esHoy(c.ts, hoy)));
const enCurso = (e: EstadoV2) => e.objetivos.filter((o) => o.estado === 'active');

/** Gasto mensual equivalente de un tope semanal: cuatro semanas. */
const SEMANAS_POR_MES = 4;

const DEFS: Def[] = [
  // ── Nivel 1: lo básico ────────────────────────────────────────────────
  {
    base: 'primer_gasto', nivel: 1, vez: 'una', enRotacion: false,
    titulo: () => 'Registrá tu primer gasto',
    msg: 'Con eso ya te armamos tus secciones y tu análisis solo.',
    cta: 'Registrar un gasto', destino: GASTOS, abrir: 'gasto',
    candidatos: () => ninguno,
    cumplido: (e) => e.gastos.length > 0,
  },
  {
    // Va alto porque sin teléfono verificado no anda el bot, que es lo que
    // más sostiene el registro.
    base: 'verificar_telefono', nivel: 1, vez: 'una', enRotacion: true,
    titulo: () => 'Verificá tu teléfono',
    msg: 'Así podés contarle tus gastos a FINA por WhatsApp, sin abrir la app.',
    cta: 'Verificar ahora', destino: PERFIL, abrir: 'verificar',
    candidatos: (e) => (!e.perfil.telefonoVerificadoEn ? uno(88) : ninguno),
    cumplido: (e) => !!e.perfil.telefonoVerificadoEn,
  },
  {
    // Un gasto fijo que vence en tres días o menos: lo único con fecha que no se mueve.
    base: 'fijo_cerca', nivel: 1, vez: 'diaria', enRotacion: true, entidad: 'fijo',
    titulo: (n) => (n ? `Revisá que tengas para ${n}` : 'Revisá que tengas para tu próximo gasto fijo'),
    msg: 'Vence en estos días. Fijate si la plata está en el medio de pago con el que lo pagás.',
    cta: 'Ver mis gastos fijos', destino: GASTOS, abrir: 'fijos',
    candidatos: (e, hoy) => e.gastosFijos
      .map((f) => ({ f, dias: diasEntre(hoy, f.proximoPago) }))
      .filter(({ dias }) => dias >= 0 && dias <= 3)
      .map(({ f, dias }) => ({ params: [f.id, f.proximoPago], puntaje: 95 - dias * 3 })),
    // Se cumple si lo marcó pagado (el próximo pago se corrió), o si hoy cargó
    // plata o anotó un ingreso: es lo que hace quien revisó y le faltaba.
    cumplido: (e, hoy, [id, fecha]) => {
      const f = e.gastosFijos.find((x) => x.id === id);
      if (f && fecha && f.proximoPago > fecha) return true;
      return e.cargas.some((c) => esHoy(c.ts, hoy)) || e.ingresos.some((i) => esHoy(i.ts, hoy));
    },
  },
  {
    // Más relevante a medida que avanza el mes: el 3 puede que todavía no haya cobrado.
    base: 'ingreso_mes', nivel: 1, vez: 'diaria', enRotacion: true,
    titulo: () => 'Anotá lo que te entró este mes',
    msg: 'Con lo que entra al lado de lo que sale, se ve cuánto te queda.',
    cta: 'Anotar un ingreso', destino: GASTOS,
    candidatos: (e, hoy) => (e.gastos.length > 0 && !e.ingresos.some((i) => diaArgentina(i.ts).slice(0, 7) === hoy.slice(0, 7))
      ? uno(55 + Math.min(25, Number(hoy.slice(8, 10))))
      : ninguno),
    cumplido: (e, hoy) => e.ingresos.some((i) => diaArgentina(i.ts).slice(0, 7) === hoy.slice(0, 7)),
  },
  {
    base: 'primer_objetivo', nivel: 1, vez: 'una', enRotacion: true,
    titulo: () => 'Elegí algo para lo que juntar',
    msg: 'Un viaje, un colchón, algo que quieras. Con un objetivo, lo que separás tiene a dónde ir.',
    cta: 'Elegir un objetivo', destino: OBJETIVOS,
    candidatos: (e) => (enCurso(e).length === 0 ? uno(e.gastos.length >= 5 ? 72 : 64) : ninguno),
    cumplido: (e) => enCurso(e).length > 0,
  },
  {
    base: 'nivel_financiero', nivel: 1, vez: 'una', enRotacion: true,
    titulo: () => 'Descubrí tu nivel financiero',
    msg: 'Una pregunta, y te explicamos las cosas a tu medida.',
    cta: 'Descubrirlo', destino: PERFIL, abrir: 'nivel',
    candidatos: (e) => (!e.perfil.nivelFinanciero ? uno(50) : ninguno),
    cumplido: (e) => !!e.perfil.nivelFinanciero,
  },

  // ── Nivel 2: ordenar ──────────────────────────────────────────────────
  {
    // Una sección donde gasta seguido (3 o más gastos en 30 días) y sin tope.
    // Las dos con más movimiento, para no llenar la lista de secciones.
    base: 'tope_seccion', nivel: 2, vez: 'una', enRotacion: true, entidad: 'seccion',
    titulo: (n) => (n ? `Ponele un tope a ${n}` : 'Ponele un tope a una sección'),
    msg: 'Es donde más seguido gastás. Un tope no es una prohibición: te avisa cuánto te queda.',
    cta: 'Poner un tope', destino: GASTOS, abrir: 'tope',
    candidatos: (e, hoy) => {
      const desde = tsDe(hoy) - 30 * DIA_MS;
      return e.secciones
        .filter((s) => s.tope === null)
        .map((s) => ({ s, n: e.gastos.filter((g) => g.seccionId === s.id && g.ts >= desde).length }))
        .filter(({ n }) => n >= 3)
        .sort((a, b) => b.n - a.n)
        .slice(0, 2)
        .map(({ s, n }) => ({ params: [s.id], puntaje: 70 + Math.min(15, n) }));
    },
    cumplido: (e, _hoy, [id]) => e.secciones.some((s) => s.id === id && s.tope !== null),
  },
  {
    // Con id: un objetivo en curso al que no le sumó nada hace dos semanas o
    // más (o nunca). Sin id: cualquiera, para quien viene aportando seguido.
    base: 'aporte_objetivo', nivel: 2, vez: 'diaria', enRotacion: true, entidad: 'objetivo',
    titulo: (n) => (n ? `Sumale algo a ${n}` : 'Sumale algo a tu objetivo'),
    msg: 'No importa cuánto. Lo que importa es que avance.',
    cta: 'Sumarle a mi objetivo', destino: OBJETIVOS, abrir: 'aporte_objetivo',
    candidatos: (e, hoy) => {
      const lista = enCurso(e);
      if (lista.length === 0) return ninguno;
      const quietos = lista.flatMap((o) => {
        const ultimo = ultimoAporte(o);
        const dias = ultimo === null ? 21 : diasEntre(diaArgentina(ultimo), hoy);
        return dias >= 14 ? [{ params: [o.id], puntaje: 70 + Math.min(18, Math.floor(dias / 7) * 4) }] : [];
      });
      return [...quietos.sort((a, b) => b.puntaje - a.puntaje).slice(0, 2), { params: [], puntaje: 38 }];
    },
    cumplido: (e, hoy, [id]) => aporteHoy(e, hoy, id),
  },
  {
    base: 'monto_objetivo', nivel: 2, vez: 'una', enRotacion: true, entidad: 'objetivo',
    titulo: (n) => (n ? `Ponele un monto a ${n}` : 'Ponele un monto a tu objetivo'),
    msg: 'Aunque sea aproximado. Con un número se puede ver cuánto falta y a qué ritmo llegás.',
    cta: 'Ponerle un monto', destino: OBJETIVOS,
    candidatos: (e) => enCurso(e).filter((o) => o.montoTotal === null).slice(0, 1).map((o) => ({ params: [o.id], puntaje: 62 })),
    cumplido: (e, _hoy, [id]) => e.objetivos.some((o) => o.id === id && o.montoTotal !== null),
  },
  {
    base: 'cargar_fijo', nivel: 2, vez: 'una', enRotacion: true,
    titulo: () => 'Anotá un gasto fijo',
    msg: 'El alquiler, el gimnasio, una suscripción. Te avisamos antes de que venza.',
    cta: 'Anotar un gasto fijo', destino: GASTOS, abrir: 'fijos',
    candidatos: (e) => (e.gastosFijos.length === 0 && e.gastos.length >= 5 ? uno(56) : ninguno),
    cumplido: (e) => e.gastosFijos.length > 0,
  },
  {
    base: 'perfil_inversor', nivel: 2, vez: 'una', enRotacion: true,
    titulo: () => 'Averiguá tu perfil de inversor',
    msg: 'Son dos minutos, y las recomendaciones pasan a tener que ver con vos.',
    cta: 'Armar mi perfil', destino: INVERSIONES, abrir: 'quiz',
    candidatos: (e) => (!e.perfilInversor?.completadoEn ? uno(46) : ninguno),
    cumplido: (e) => !!e.perfilInversor?.completadoEn,
  },
  {
    base: 'aporte_inversion', nivel: 2, vez: 'diaria', enRotacion: true,
    titulo: () => 'Anotá un aporte a tus inversiones',
    msg: 'Si pusiste plata en algún lado, anotala y seguí cómo evoluciona.',
    cta: 'Registrar un aporte', destino: INVERSIONES, abrir: 'aporte',
    candidatos: (e) => (e.perfilInversor?.completadoEn ? uno(32) : ninguno),
    cumplido: (e, hoy) => e.aportes.some((a) => esHoy(a.ts, hoy)),
  },
  {
    base: 'grupo', nivel: 2, vez: 'una', enRotacion: true,
    titulo: () => 'Armá un grupo con amigas',
    msg: 'Compiten por quién registra más. Nadie ve cuánto gastás.',
    cta: 'Armar un grupo', destino: GRUPOS, abrir: 'grupo',
    candidatos: (e) => (e.grupo === null ? uno(26) : ninguno),
    cumplido: (e) => e.grupo !== null,
  },

  // ── Nivel 3: mejorar ──────────────────────────────────────────────────
  {
    // Le entró plata hace poco y desde entonces no le sumó a ningún objetivo:
    // separar apenas entra es lo que más mueve.
    base: 'separar_ingreso', nivel: 3, vez: 'diaria', enRotacion: true,
    titulo: () => 'Separá algo de lo que te entró',
    msg: 'Apenas entra la plata es cuando más fácil es apartar una parte.',
    cta: 'Sumarle a un objetivo', destino: OBJETIVOS, abrir: 'aporte_objetivo',
    candidatos: (e, hoy) => {
      if (enCurso(e).length === 0) return ninguno;
      const desde = tsDe(hoy) - 7 * DIA_MS;
      const ultimoIngreso = Math.max(0, ...e.ingresos.filter((i) => i.ts >= desde).map((i) => i.ts));
      if (!ultimoIngreso) return ninguno;
      const aporteDespues = e.objetivos.some((o) => o.contribuciones.some((c) => c.ts >= ultimoIngreso));
      return aporteDespues ? ninguno : uno(84);
    },
    cumplido: (e, hoy) => aporteHoy(e, hoy),
  },
  {
    // Un tope que no se parece a lo que pasa: el mes pasado se gastó bastante
    // más o bastante menos. La clave lleva el tope de hoy, así cambiarlo (o
    // sacarlo) es lo que cumple el paso.
    base: 'ajustar_tope', nivel: 3, vez: 'diaria', enRotacion: true, entidad: 'seccion',
    titulo: (n) => (n ? `Revisá el tope de ${n}` : 'Revisá el tope de una sección'),
    msg: 'El mes pasado esa sección no se pareció a su tope. Un tope que se ajusta a lo real avisa mejor.',
    cta: 'Revisar el tope', destino: GASTOS, abrir: 'tope',
    candidatos: (e, hoy) => {
      const hastaPasado = sumarDiasAR(inicioDeMes(hoy), -1);
      const desdePasado = inicioDeMes(hastaPasado);
      return e.secciones.flatMap((s) => {
        if (!s.tope || s.tope.monto <= 0) return [];
        const delMes = e.gastos.filter((g) => g.seccionId === s.id && diaArgentina(g.ts) >= desdePasado && diaArgentina(g.ts) <= hastaPasado);
        if (delMes.length < 3) return [];
        const mensual = s.tope.periodo === 'mes' ? s.tope.monto : s.tope.monto * SEMANAS_POR_MES;
        const ratio = delMes.reduce((a, g) => a + g.montoArs, 0) / mensual;
        if (ratio <= 1.15 && ratio >= 0.6) return [];
        return [{ params: [s.id, String(s.tope.monto)], puntaje: 66 + Math.min(12, Math.round(Math.abs(ratio - 1) * 10)) }];
      }).slice(0, 2);
    },
    cumplido: (e, _hoy, [id, monto]) => {
      const s = e.secciones.find((x) => x.id === id);
      return !!s && (s.tope === null || String(s.tope.monto) !== monto);
    },
  },
  {
    // Para quien ya tiene más de un mes registrado y algo en los dos tramos.
    base: 'revisar_mes', nivel: 3, vez: 'diaria', enRotacion: true,
    titulo: () => 'Compará tu mes con el anterior',
    msg: 'Lo que llevás gastado este mes contra los mismos días del mes pasado.',
    cta: 'Comparar', destino: 'revision', revision: 'mes',
    candidatos: (e, hoy) => {
      const primero = primerDia(e);
      if (!primero || diasEntre(primero, hoy) < 35 || Number(hoy.slice(8, 10)) < 7) return ninguno;
      const c = compararConMesPasado(e, hoy);
      return c.cantidadEsteMes >= 3 && c.cantidadMesPasado >= 3 ? uno(58) : ninguno;
    },
    cumplido: () => false,
  },
  {
    // Una sección que este mes viene distinta (30% o más) que a esta altura del mes pasado.
    base: 'comparar_seccion', nivel: 3, vez: 'diaria', enRotacion: true, entidad: 'seccion', revision: 'seccion',
    titulo: (n) => (n ? `Compará ${n} con el mes pasado` : 'Compará una sección con el mes pasado'),
    msg: 'Esa sección viene distinta que a esta altura del mes pasado.',
    cta: 'Comparar', destino: 'revision',
    candidatos: (e, hoy) => {
      const primero = primerDia(e);
      if (!primero || diasEntre(primero, hoy) < 35 || Number(hoy.slice(8, 10)) < 7) return ninguno;
      return e.secciones.flatMap((s) => {
        const c = compararConMesPasado(e, hoy, s.id);
        if (c.cantidadEsteMes < 2 || c.cantidadMesPasado < 2 || c.mismosDiasMesPasado <= 0) return [];
        const cambio = Math.abs(c.esteMes - c.mismosDiasMesPasado) / c.mismosDiasMesPasado;
        return cambio >= 0.3 ? [{ params: [s.id], puntaje: 60 + Math.min(15, Math.round(cambio * 10)), cambio }] : [];
      }).sort((a, b) => b.cambio - a.cambio).slice(0, 2).map(({ params, puntaje }) => ({ params, puntaje }));
    },
    cumplido: () => false,
  },

  // ── Viejos: fuera de la rotación ──────────────────────────────────────
  {
    base: 'tope', nivel: 2, vez: 'una', enRotacion: false,
    titulo: () => 'Ponele un tope a una sección',
    msg: 'Elegí la que más se te va y decidí hasta cuánto. No es una prohibición: es un aviso.',
    cta: 'Poner un tope', destino: GASTOS, abrir: 'tope',
    candidatos: () => ninguno,
    cumplido: (e) => e.secciones.some((s) => s.tope !== null),
  },
  {
    base: 'gasto_hoy', nivel: 1, vez: 'diaria', enRotacion: false,
    titulo: () => 'Registrá un gasto de hoy',
    msg: 'Aunque sea el café. Lo que no se anota, no se ve.',
    cta: 'Registrar un gasto', destino: GASTOS, abrir: 'gasto',
    candidatos: () => ninguno,
    cumplido: (e, hoy) => e.gastos.some((g) => esHoy(g.ts, hoy)),
  },
  {
    base: 'gasto_whatsapp', nivel: 1, vez: 'diaria', enRotacion: false,
    titulo: () => 'Contale un gasto a FINA por WhatsApp',
    msg: 'Escribile como a una amiga: "gasté 5.000 en el súper". Ella lo anota.',
    cta: 'Abrir WhatsApp', destino: 'whatsapp',
    candidatos: () => ninguno,
    cumplido: (e, hoy) => e.gastos.some((g) => g.origen === 'whatsapp' && esHoy(g.ts, hoy)),
  },
];

const DEF_POR_BASE = new Map<string, Def>(DEFS.map((d) => [d.base, d]));

// Las claves viajan en la dirección (?pasos=a,b) y se guardan en la base: sólo
// letras, números, guiones y puntos en cada dato, sin comas ni espacios.
const CLAVE_VALIDA = /^[a-z_]+(?::[A-Za-z0-9._-]{1,64}){0,3}$/;

function parsear(clave: string): { def: Def; params: string[] } | null {
  if (!CLAVE_VALIDA.test(clave)) return null;
  const [base, ...params] = clave.split(':');
  const def = DEF_POR_BASE.get(base);
  return def ? { def, params } : null;
}

const armarClave = (base: BasePaso, params: string[]) => (params.length ? `${base}:${params.join(':')}` : base);

/** Busca los nombres en el estado de la app. */
export function nombresDeEstado(e: EstadoV2): Nombres {
  return {
    seccion: (id) => e.secciones.find((s) => s.id === id)?.nombre,
    objetivo: (id) => e.objetivos.find((o) => o.id === id)?.nombre,
    fijo: (id) => e.gastosFijos.find((f) => f.id === id)?.descripcion,
  };
}

function armarPaso(def: Def, params: string[], nombres?: Nombres): Paso {
  const ref = def.entidad && params[0] ? params[0] : null;
  const nombre = ref && def.entidad ? nombres?.[def.entidad]?.(ref)?.trim() || null : null;
  return {
    clave: armarClave(def.base, params),
    base: def.base,
    nivel: def.nivel,
    vez: def.vez,
    titulo: def.titulo(nombre),
    msg: def.msg,
    cta: def.cta,
    destino: def.destino,
    abrir: def.abrir,
    ref,
    revision: def.revision,
  };
}

/** El paso de una clave guardada. Con el estado, el título lleva el nombre de lo que habla. */
export function pasoPorClave(clave: string, e?: EstadoV2): Paso | undefined {
  const p = parsear(clave);
  return p ? armarPaso(p.def, p.params, e ? nombresDeEstado(e) : undefined) : undefined;
}

/** El título de una clave, para el servidor (avisos, prompt) que arma sus propios nombres. */
export function tituloDePaso(clave: string, nombres?: Nombres): string | null {
  const p = parsear(clave);
  return p ? armarPaso(p.def, p.params, nombres).titulo : null;
}

/** De qué sección, objetivo o gasto fijo habla una clave, para buscar su nombre. */
export function entidadDeClave(clave: string): { tipo: Entidad; id: string } | null {
  const p = parsear(clave);
  return p?.def.entidad && p.params[0] ? { tipo: p.def.entidad, id: p.params[0] } : null;
}

/** Si una clave puede elegirse como paso de un día (la IA no elige el primer gasto ni los viejos). */
export function esClaveElegible(clave: string): boolean {
  return parsear(clave)?.def.enRotacion ?? false;
}

/** Si el paso de hoy ya está cumplido. Los de revisión se cumplen al contestar la pregunta (`revisados`). */
export function estaCumplido(clave: string, e: EstadoV2, hoy: string, revisados: ReadonlySet<string> = new Set()): boolean {
  const p = parsear(clave);
  if (!p) return false;
  if (p.def.revision) return revisados.has(clave);
  return p.def.cumplido(e, hoy, p.params);
}

// ── A quién le toca cuál ─────────────────────────────────────────────────

/** Los pasos de los últimos días, para no repetir. */
export type Historial = {
  /** La clave del paso de ayer, o null. */
  ayer: string | null;
  /** Las claves de los últimos 7 días (sin hoy). */
  recientes: string[];
};

// Un número estable por día y clave, para variar entre pasos que puntúan
// parecido sin que dos dispositivos elijan distinto.
function variacion(dia: string, clave: string): number {
  let h = 0;
  for (const ch of `${dia}|${clave}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 9;
}

type Opciones = { excluir?: Iterable<string>; ayer?: string | null; racha?: number; respetarNivel?: boolean };

/**
 * Los pasos que le sirven hoy a la persona, del más al menos relevante.
 *
 * El puntaje sale de sus datos (un gasto fijo que vence en dos días pesa más
 * que armar un grupo). Encima: +8 a los del nivel que acaba de destrabar, así
 * cada nivel nuevo se siente; -25 a uno del mismo tipo que el de ayer, así no
 * se encadenan dos topes seguidos; y una variación chica por día.
 */
export function candidatosDelDia(e: EstadoV2, hoy: string, op: Opciones = {}): { paso: Paso; puntaje: number }[] {
  const nivel = nivelDe(e, op.racha);
  const excluir = new Set(op.excluir ?? []);
  const baseAyer = op.ayer ? op.ayer.split(':')[0] : null;
  const nombres = nombresDeEstado(e);
  const lista: { paso: Paso; puntaje: number }[] = [];
  for (const def of DEFS) {
    if (!def.enRotacion) continue;
    if (op.respetarNivel !== false && def.nivel > nivel) continue;
    for (const c of def.candidatos(e, hoy)) {
      const paso = armarPaso(def, c.params, nombres);
      // Un id con caracteres raros no se podría volver a leer de la base.
      if (excluir.has(paso.clave) || !CLAVE_VALIDA.test(paso.clave)) continue;
      const puntaje = c.puntaje
        + (def.nivel === nivel && nivel > 1 ? 8 : 0)
        - (def.base === baseAyer ? 25 : 0)
        + variacion(hoy, paso.clave);
      lista.push({ paso, puntaje });
    }
  }
  return lista.sort((a, b) => b.puntaje - a.puntaje);
}

/**
 * Elige el paso de hoy.
 *
 * · Sin gastos, el primero siempre es registrar uno: es el hábito que sostiene
 *   todo lo demás.
 * · Después, el más relevante para sus datos entre los de su nivel, sin
 *   repetir ninguno de los últimos 7 días.
 * · Si ya pasó por todos en la semana, el que hace más que no ve (nunca el de
 *   ayer), aunque sea de un nivel más alto.
 *
 * Es determinística: los mismos datos y el mismo día dan el mismo paso. No es
 * lo que garantiza que no cambie en el día (eso lo garantiza que se guarda),
 * pero hace que dos dispositivos que eligen a la vez elijan lo mismo.
 */
export function elegirPaso(e: EstadoV2, hoy: string, historial: Historial, racha = 0): ClavePaso {
  if (e.gastos.length === 0 && historial.ayer !== 'primer_gasto') return 'primer_gasto';

  const nuevos = candidatosDelDia(e, hoy, { excluir: historial.recientes, ayer: historial.ayer, racha });
  if (nuevos.length > 0) return nuevos[0].paso.clave;

  const todos = candidatosDelDia(e, hoy, { excluir: historial.ayer ? [historial.ayer] : [], ayer: historial.ayer, racha, respetarNivel: false });
  if (todos.length > 0) {
    const hace = (clave: string) => { const i = historial.recientes.indexOf(clave); return i === -1 ? Infinity : i; };
    return [...todos].sort((a, b) => hace(b.paso.clave) - hace(a.paso.clave) || b.puntaje - a.puntaje)[0].paso.clave;
  }
  // No queda nada que proponer: el registro del día, como último recurso.
  return historial.ayer === 'gasto_hoy' ? 'gasto_whatsapp' : 'gasto_hoy';
}

// ── El paso elegido por la IA ────────────────────────────────────────────
/**
 * Los pasos entre los que la IA puede elegir el de mañana: los de su nivel que
 * le sirven con sus datos, del más al menos relevante, menos el de hoy y los
 * de la última semana (el servidor vuelve a sacar los de la semana con lo que
 * tiene guardado). Nunca "tu primer gasto", que lo decide la regla.
 */
export function pasosPosiblesManana(e: EstadoV2, claveDeHoy: string | null, recientes: string[] = [], racha = 0): ClavePaso[] {
  const manana = sumarDiasAR(diaArgentina(), 1);
  const excluir = claveDeHoy ? [claveDeHoy, ...recientes] : recientes;
  return candidatosDelDia(e, manana, { excluir, ayer: claveDeHoy, racha }).slice(0, 8).map((c) => c.paso.clave);
}

/**
 * Si el paso que la IA eligió ayer para hoy todavía sirve. Se eligió con los
 * datos de ayer: desde entonces pudo haberse vuelto imposible o ya estar hecho
 * (si le eligió "poné un tope" y anoche puso uno, hoy se cumpliría solo y la
 * racha sumaría un día sin hacer nada). En ese caso decide la regla.
 */
export function pasoElegidoSirve(e: EstadoV2, clave: string, historial: Historial, hoy: string): boolean {
  if (e.gastos.length === 0 || !esClaveElegible(clave)) return false;
  if (clave === historial.ayer || historial.recientes.includes(clave)) return false;
  return candidatosDelDia(e, hoy, { respetarNivel: false }).some((c) => c.paso.clave === clave);
}

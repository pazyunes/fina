// Gastos que se repiten solos: el café de los lunes, la SUBE de los martes y
// jueves. Se detectan mirando qué gastos la persona anotó siempre el mismo día
// de la semana, y sirven para recordarle ese día, si todavía no anotó nada
// parecido ("¿hoy gastaste en café?").
//
// Sin ninguna base nueva: sale de los gastos que ya están. Corre en la app y en
// el servidor (el aviso de la tarde), por eso no depende de nada de acá adentro.

export type GastoParaHabito = {
  descripcion: string;
  monto: number;
  /** 'YYYY-MM-DD', el día en Argentina. */
  fecha: string;
  seccionId: string | null;
};

export type Habito = {
  /** El nombre normalizado: es lo que junta "Café", "cafe " y "CAFÉ 2". */
  clave: string;
  /** Cómo lo escribió la persona la última vez. */
  descripcion: string;
  seccionId: string | null;
  /** La mediana de lo que gastó, redondeada: es lo que se le ofrece al anotarlo. */
  montoTipico: number;
  /** 0 = domingo … 6 = sábado. */
  diasDeSemana: number[];
};

/** Cuántas semanas hacia atrás se mira. */
export const SEMANAS_QUE_SE_MIRAN = 8;
/** Con cuántas veces el mismo día de la semana ya es un hábito. */
export const VECES_PARA_HABITO = 3;
/** Un hábito que no se repite hace más que esto se da por terminado. */
const DIAS_SIN_REPETIR = 21;

/** "Café 2", "CAFÉ" y "cafe " son lo mismo. Sin números, sin tildes. */
export function claveDeGasto(descripcion: string): string {
  return descripcion
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const aUtc = (fecha: string) => Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)));
export const diaDeSemana = (fecha: string): number => new Date(aUtc(fecha)).getUTCDay();
const diasEntre = (desde: string, hasta: string): number => Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);

function mediana(n: number[]): number {
  const o = [...n].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Un monto redondeado a algo que se pueda leer ($8.200, no $8.213). */
const redondear = (n: number): number => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

export function detectarHabitos(gastos: GastoParaHabito[], hoy: string): Habito[] {
  const porClave = new Map<string, GastoParaHabito[]>();
  for (const g of gastos) {
    const k = claveDeGasto(g.descripcion);
    // Una descripción de una o dos letras no dice nada.
    if (k.length < 3 || g.monto <= 0) continue;
    const dias = diasEntre(g.fecha, hoy);
    // Sólo lo que ya pasó, dentro de la ventana.
    if (dias < 1 || dias > SEMANAS_QUE_SE_MIRAN * 7) continue;
    porClave.set(k, [...(porClave.get(k) ?? []), g]);
  }

  const habitos: Habito[] = [];
  for (const [clave, lista] of porClave) {
    // Un día con dos gastos iguales cuenta una vez.
    const dias = [...new Set(lista.map((g) => g.fecha))];
    if (dias.length < VECES_PARA_HABITO) continue;
    const ultima = dias.reduce((a, b) => (a > b ? a : b));
    if (diasEntre(ultima, hoy) > DIAS_SIN_REPETIR) continue;

    const porDia = new Map<number, number>();
    for (const f of dias) porDia.set(diaDeSemana(f), (porDia.get(diaDeSemana(f)) ?? 0) + 1);
    const diasDeSemana = [...porDia.entries()].filter(([, veces]) => veces >= VECES_PARA_HABITO).map(([d]) => d).sort((a, b) => a - b);
    if (diasDeSemana.length === 0) continue;

    const recientes = [...lista].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    habitos.push({
      clave,
      descripcion: recientes[0].descripcion.trim().slice(0, 80),
      seccionId: recientes[0].seccionId,
      montoTipico: redondear(mediana(lista.map((g) => g.monto))),
      diasDeSemana,
    });
  }
  return habitos;
}

/** Los hábitos que tocan hoy y todavía no tienen un gasto anotado hoy. */
export function habitosDeHoy(habitos: Habito[], gastos: GastoParaHabito[], hoy: string): Habito[] {
  const dow = diaDeSemana(hoy);
  const anotadosHoy = new Set(gastos.filter((g) => g.fecha === hoy).map((g) => claveDeGasto(g.descripcion)));
  return habitos.filter((h) => h.diasDeSemana.includes(dow) && !anotadosHoy.has(h.clave));
}

/**
 * Cuántas veces anotó este gasto el mismo día de la semana que `fecha`, contando
 * esa fecha. Sirve para preguntar "¿te lo recordamos?" cuando ya lo hizo 2 o 3 veces.
 */
export function repeticionesEseDia(gastos: GastoParaHabito[], descripcion: string, fecha: string): number {
  const k = claveDeGasto(descripcion);
  if (k.length < 3) return 0;
  const dow = diaDeSemana(fecha);
  const dias = new Set(
    gastos
      .filter((g) => claveDeGasto(g.descripcion) === k && diaDeSemana(g.fecha) === dow && diasEntre(g.fecha, fecha) >= 0 && diasEntre(g.fecha, fecha) <= SEMANAS_QUE_SE_MIRAN * 7)
      .map((g) => g.fecha),
  );
  return dias.size;
}

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DIA_DEL_PLURAL = (d: number) => DIAS[d];

/** "los lunes", "los lunes y jueves", "los lunes, miércoles y viernes". */
export function diasEnTexto(dias: number[]): string {
  const nombres = dias.map(DIA_DEL_PLURAL);
  return `los ${nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]}`;
}

const DIA_SINGULAR = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const nombreDelDia = (dia: number): string => DIA_SINGULAR[dia];

export type SugerenciaHabito = {
  clave: string;
  descripcion: string;
  /** Cuántas veces lo anotó ese día de la semana (2 o 3). */
  veces: number;
  /** 0 = domingo … 6 = sábado. */
  dia: number;
};

/**
 * Después de anotar un gasto: si ya lo anotó 2 o 3 veces el mismo día de la
 * semana, es el momento de preguntarle si quiere que se lo recordemos.
 * `preguntado` dice a qué gastos ya se les preguntó (se pregunta una sola vez).
 */
export function sugerenciaDeHabito(gastos: GastoParaHabito[], descripcion: string, fecha: string, preguntado: (clave: string) => boolean): SugerenciaHabito | null {
  const clave = claveDeGasto(descripcion);
  const veces = repeticionesEseDia(gastos, descripcion, fecha);
  if (clave.length < 3 || veces < 2 || veces > VECES_PARA_HABITO || preguntado(clave)) return null;
  return { clave, descripcion: descripcion.trim().slice(0, 80), veces, dia: diaDeSemana(fecha) };
}

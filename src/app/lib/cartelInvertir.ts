// Cada tanto, a quien todavía no invierte, un cartel en Inicio que le muestra
// que puede empezar. No es un aviso permanente: se muestra un día, se puede
// cerrar y no vuelve hasta pasados unos días.
//
// Qué se recuerda, en este dispositivo: el último día que se mostró, cuántas
// veces y si se cerró. Es una comodidad, no un dato de la persona: sin
// almacenamiento, el cartel se ve como la primera vez.

const CLAVE = 'fina_cartel_invertir';
/** Cada cuántos días vuelve a aparecer. */
export const DIAS_ENTRE_CARTELES = 10;
/** Cuántos gastos tiene que haber anotado: a quien recién empieza no se le pide invertir. */
export const GASTOS_PARA_EL_CARTEL = 5;

type Guardado = { dia: string; veces: number; cerrado: boolean };

function leer(): Guardado | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    return typeof o.dia === 'string' && typeof o.veces === 'number' ? { dia: o.dia, veces: o.veces, cerrado: o.cerrado === true } : null;
  } catch {
    return null;
  }
}
function escribir(g: Guardado) {
  try { localStorage.setItem(CLAVE, JSON.stringify(g)); } catch { /* sin almacenamiento: no pasa nada */ }
}

const aUtc = (f: string) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));

/**
 * ¿Toca mostrar el cartel hoy? Devuelve cuál de las frases (0, 1, 2…) y deja
 * anotado que se mostró hoy. Mientras sea el mismo día y no se haya cerrado, sigue a la vista.
 */
export function cartelDeHoy(hoy: string, cuantas: number): number | null {
  const g = leer();
  if (g && g.dia === hoy) return g.cerrado ? null : (g.veces - 1) % cuantas;
  const pasaron = g ? Math.round((aUtc(hoy) - aUtc(g.dia)) / 86_400_000) : Infinity;
  if (pasaron < DIAS_ENTRE_CARTELES) return null;
  const veces = (g?.veces ?? 0) + 1;
  escribir({ dia: hoy, veces, cerrado: false });
  return (veces - 1) % cuantas;
}

export function cerrarCartelInvertir(hoy: string) {
  const g = leer();
  escribir({ dia: g?.dia ?? hoy, veces: g?.veces ?? 1, cerrado: true });
}

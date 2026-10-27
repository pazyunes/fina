import { useSyncExternalStore } from 'react';
import { nuevoId } from './acciones';
import { diaArgentina } from './pasos';
import type { TipoGasto } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// Gastos recurrentes: lo que la persona gasta seguido (el colectivo, el café)
// y quiere registrar sin completar nada. Se marcan al registrar un gasto, con
// cada cuánto se repite y a qué hora avisar:
//   · por día: cuántas veces y a qué hora cada una (el colectivo, ida y vuelta);
//   · por semana: qué días, a una hora;
//   · por mes: el día del mes del gasto, a una hora.
//
// PRUEBA (viene de la rama gastos-fijos-aparte): se guardan en este navegador,
// no en la base. Para la versión final van a una tabla propia, así se ven en
// todos los dispositivos y el aviso puede llegar al celular a la hora elegida.
// ─────────────────────────────────────────────────────────────────────────

export type FrecuenciaRecurrente = 'diaria' | 'semanal' | 'mensual';

export type GastoRecurrente = {
  id: string;
  /** Lo que escribió al registrarlo ("Café"). Los que no lo tienen se muestran con su categoría. */
  descripcion?: string;
  seccionId: string | null;
  monto: number;
  moneda: 'ARS' | 'USD';
  tipo: TipoGasto;
  metodoPago: string | null;
  frecuencia: FrecuenciaRecurrente;
  /** 'HH:MM', ordenadas. Por día, una por cada vez; por semana y por mes, una sola. */
  horas: string[];
  /** Por semana: los días en que se repite (0 = domingo). */
  dias: number[];
  /** Por mes: el día del mes. */
  dia: number | null;
  /** Lo registrado con un toque el último día que se usó: cuántas veces y qué gastos, para poder deshacer. */
  registros: { dia: string; gastoIds: string[] } | null;
};

/** Cómo lo guardaba la primera prueba: una sola hora y un solo registro por día. */
type Guardado = Omit<GastoRecurrente, 'horas' | 'dias' | 'registros'> & {
  horas?: string[]; dias?: number[]; registros?: GastoRecurrente['registros'];
  hora?: string; ultimoDia?: string | null; ultimoGastoId?: string | null;
};

// Misma clave que en la rama de prueba: lo que ya se cargó allá se sigue leyendo.
const CLAVE = 'fina_v2_gastos_recurrentes';
const oyentes = new Set<() => void>();
let cache: GastoRecurrente[] | null = null;

/** Lleva lo guardado por la primera prueba a la forma de ahora, sin perder nada. */
function normalizar(g: Guardado): GastoRecurrente {
  const { hora, ultimoDia, ultimoGastoId, ...resto } = g;
  return {
    ...resto,
    horas: g.horas?.length ? g.horas : [hora ?? '20:00'],
    dias: g.dias ?? (g.frecuencia === 'semanal' && g.dia !== null ? [g.dia] : []),
    dia: g.frecuencia === 'mensual' ? g.dia : null,
    registros: g.registros !== undefined ? g.registros : ultimoDia ? { dia: ultimoDia, gastoIds: ultimoGastoId ? [ultimoGastoId] : [''] } : null,
  };
}

function leer(): GastoRecurrente[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(CLAVE);
    cache = raw ? (JSON.parse(raw) as Guardado[]).map(normalizar) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function escribir(lista: GastoRecurrente[]) {
  cache = lista;
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* modo privado: queda en memoria */ }
  for (const o of oyentes) o();
}

function suscribir(o: () => void): () => void {
  oyentes.add(o);
  return () => { oyentes.delete(o); };
}

export function useRecurrentes(): GastoRecurrente[] {
  return useSyncExternalStore(suscribir, leer);
}

export function crearRecurrente(r: Omit<GastoRecurrente, 'id'>): void {
  escribir([...leer(), { ...r, id: nuevoId() }]);
}

export function actualizarRecurrente(id: string, cambios: Partial<GastoRecurrente>): void {
  escribir(leer().map((r) => (r.id === id ? { ...r, ...cambios } : r)));
}

export function borrarRecurrente(id: string): void {
  escribir(leer().filter((r) => r.id !== id));
}

/** Si hoy le toca: todos los días, uno de sus días de la semana o su día del mes (el último si el mes es más corto). */
export function tocaHoy(r: GastoRecurrente, ahora = new Date()): boolean {
  if (r.frecuencia === 'diaria') return true;
  if (r.frecuencia === 'semanal') return r.dias.includes(ahora.getDay());
  const ultimoDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  return ahora.getDate() === Math.min(r.dia ?? 1, ultimoDelMes);
}

/** Cuántas veces le toca hoy: las horas por día; una por semana o por mes; ninguna si hoy no es su día. */
export function vecesHoy(r: GastoRecurrente, ahora = new Date()): number {
  if (!tocaHoy(r, ahora)) return 0;
  return r.frecuencia === 'diaria' ? r.horas.length : 1;
}

/** Cuántas veces se registró hoy con un toque. */
export function registradasHoy(r: GastoRecurrente, ahora = new Date()): number {
  return r.registros?.dia === diaArgentina(ahora.getTime()) ? r.registros.gastoIds.length : 0;
}

/** Cuántas le faltan registrar hoy entre las que ya pasaron su hora. */
export function pendientesHoy(r: GastoRecurrente, ahora = new Date()): number {
  if (!tocaHoy(r, ahora)) return 0;
  const hhmm = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  const horas = r.frecuencia === 'diaria' ? r.horas : r.horas.slice(0, 1);
  return Math.max(0, horas.filter((h) => h <= hhmm).length - registradasHoy(r, ahora));
}

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
// Lunes primero: es como se lee la semana en Argentina.
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** "8:00, 13:00 y 20:00". */
export function enumerar(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** "Todos los días, 9:00", "3 veces por día: 8:00, 13:00 y 20:00", "Lunes y jueves, 20:00", "El 5 de cada mes, 20:00". */
export function textoRepeticion(r: Pick<GastoRecurrente, 'frecuencia' | 'horas' | 'dias' | 'dia'>): string {
  if (r.frecuencia === 'diaria') {
    return r.horas.length > 1 ? `${r.horas.length} veces por día: ${enumerar(r.horas)}` : `Todos los días, ${r.horas[0]}`;
  }
  if (r.frecuencia === 'semanal') {
    if (r.dias.length === 7) return `Todos los días, ${r.horas[0]}`;
    const dias = enumerar(ORDEN_SEMANA.filter((d) => r.dias.includes(d)).map((d) => DIAS_PLURAL[d]));
    return `${dias.charAt(0).toUpperCase()}${dias.slice(1)}, ${r.horas[0]}`;
  }
  return `El ${r.dia} de cada mes, ${r.horas[0]}`;
}

import { useSyncExternalStore } from 'react';
import { nuevoId } from './acciones';
import { diaArgentina } from './pasos';
import type { TipoGasto } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// Gastos recurrentes: lo que la persona gasta seguido (el colectivo, el café)
// y quiere registrar sin completar nada. Se marcan al registrar un gasto, con
// cada cuánto se repite y a qué hora avisar.
//
// PRUEBA (viene de la rama gastos-fijos-aparte): se guardan en este navegador,
// no en la base. Para la versión final van a una tabla propia, así se ven en
// todos los dispositivos y el aviso puede llegar al celular a la hora elegida.
// ─────────────────────────────────────────────────────────────────────────

export type FrecuenciaRecurrente = 'diaria' | 'semanal' | 'mensual';

export type GastoRecurrente = {
  id: string;
  /** Lo que escribió al registrarlo ("Café"). Los de la prueba anterior no lo tienen: se muestran con su categoría. */
  descripcion?: string;
  seccionId: string | null;
  monto: number;
  moneda: 'ARS' | 'USD';
  tipo: TipoGasto;
  metodoPago: string | null;
  frecuencia: FrecuenciaRecurrente;
  /** 'HH:MM': desde esa hora aparece listo para registrar. */
  hora: string;
  /** Día de la semana (0 = domingo) si es semanal; día del mes si es mensual. */
  dia: number | null;
  /** El último registro con un toque: de qué día y qué gasto, para poder deshacerlo. */
  ultimoDia: string | null;
  ultimoGastoId: string | null;
};

// Misma clave que en la rama de prueba: lo que ya se cargó allá se sigue leyendo.
const CLAVE = 'fina_v2_gastos_recurrentes';
const oyentes = new Set<() => void>();
let cache: GastoRecurrente[] | null = null;

function leer(): GastoRecurrente[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(CLAVE);
    cache = raw ? (JSON.parse(raw) as GastoRecurrente[]) : [];
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

/** Si hoy le toca: todos los días, el día de la semana o el día del mes (el último si el mes es más corto). */
export function tocaHoy(r: GastoRecurrente, ahora = new Date()): boolean {
  if (r.frecuencia === 'diaria') return true;
  if (r.frecuencia === 'semanal') return ahora.getDay() === r.dia;
  const ultimoDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  return ahora.getDate() === Math.min(r.dia ?? 1, ultimoDelMes);
}

/** Hoy le toca, ya pasó su hora y todavía no se registró. */
export function pendienteHoy(r: GastoRecurrente, ahora = new Date()): boolean {
  const hhmm = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  return tocaHoy(r, ahora) && hhmm >= r.hora && r.ultimoDia !== diaArgentina(ahora.getTime());
}

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** "Todos los días, 20:00", "Los lunes, 20:00", "El 5 de cada mes, 20:00". */
export function textoRepeticion(r: Pick<GastoRecurrente, 'frecuencia' | 'dia' | 'hora'>): string {
  if (r.frecuencia === 'diaria') return `Todos los días, ${r.hora}`;
  if (r.frecuencia === 'semanal') return `Los ${DIAS[r.dia ?? 1]}, ${r.hora}`;
  return `El ${r.dia} de cada mes, ${r.hora}`;
}

// Fechas de los gastos fijos, en días de Argentina ('YYYY-MM-DD').
//
// Mensual y anual usan un "día ancla": un alquiler que vence el 31 vence el 30
// en abril y el 28 en febrero, y al mes siguiente vuelve al 31. Sin el ancla,
// después de febrero quedaría para siempre en el 28.

export type FrecuenciaFija = 'semanal' | 'quincenal' | 'mensual' | 'anual';

export const FRECUENCIAS: { id: FrecuenciaFija; label: string }[] = [
  { id: 'mensual', label: 'Todos los meses' },
  { id: 'semanal', label: 'Todas las semanas' },
  { id: 'quincenal', label: 'Cada 15 días' },
  { id: 'anual', label: 'Una vez por año' },
];

const aFecha = (dia: string) => new Date(`${dia}T12:00:00Z`);
const aDia = (d: Date) => d.toISOString().slice(0, 10);
const diasDelMes = (anio: number, mes0: number) => new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();

function conDia(anio: number, mes0: number, ancla: number): string {
  const d = new Date(Date.UTC(anio, mes0, Math.min(ancla, diasDelMes(anio, mes0)), 12));
  return aDia(d);
}

/** El vencimiento que sigue a `dia`, según la frecuencia. */
export function siguienteVencimiento(dia: string, frecuencia: FrecuenciaFija, ancla: number | null): string {
  const f = aFecha(dia);
  if (frecuencia === 'semanal') { f.setUTCDate(f.getUTCDate() + 7); return aDia(f); }
  if (frecuencia === 'quincenal') { f.setUTCDate(f.getUTCDate() + 15); return aDia(f); }
  const a = ancla ?? f.getUTCDate();
  if (frecuencia === 'mensual') return conDia(f.getUTCFullYear(), f.getUTCMonth() + 1, a);
  return conDia(f.getUTCFullYear() + 1, f.getUTCMonth(), a);
}

/** Cuántos días faltan de `hoy` a `dia` (negativo si ya pasó). */
export function diasHasta(hoy: string, dia: string): number {
  return Math.round((aFecha(dia).getTime() - aFecha(hoy).getTime()) / 86_400_000);
}

/** "hoy", "mañana", "en 5 días", "el 3 oct". */
export function cuandoVence(hoy: string, dia: string): string {
  const n = diasHasta(hoy, dia);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n > 1 && n <= 7) return `en ${n} días`;
  return `el ${aFecha(dia).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '')}`;
}

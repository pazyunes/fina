// Fechas en días de Argentina, igual que la racha (migración 0028) y que
// src/app/api/v2/pasos.ts. No se importa de ahí: esto corre en el servidor y no
// tiene que arrastrar código del cliente.
//
// Todo en 'YYYY-MM-DD'. A las 22 hs de Buenos Aires ya es el día siguiente en
// UTC: con fechas UTC, un gasto de la noche caería en el día equivocado y "ayer"
// no sería ayer.

const ZONA = 'America/Argentina/Buenos_Aires';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

export function diaAR(instante: number | string | Date = Date.now()): string {
  return formato.format(new Date(instante));
}

// Mediodía UTC para operar con días calendario sin que ningún corrimiento de
// hora mueva la fecha.
const aFecha = (dia: string) => new Date(`${dia}T12:00:00Z`);
const aDia = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDias(dia: string, n: number): string {
  const d = aFecha(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return aDia(d);
}

/** Días entre dos fechas (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 86_400_000);
}

/** 0 = lunes … 6 = domingo. La semana de FINA arranca el lunes, como el comodín. */
export function diaDeSemana(dia: string): number {
  return (aFecha(dia).getUTCDay() + 6) % 7;
}

export const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function lunesDe(dia: string): string {
  return sumarDias(dia, -diaDeSemana(dia));
}

/** Semana ISO: '2026-W38'. El año es el del jueves de esa semana (regla ISO). */
export function claveSemana(dia: string): string {
  const jueves = aFecha(sumarDias(lunesDe(dia), 3));
  const anio = jueves.getUTCFullYear();
  const primeroDeEnero = new Date(Date.UTC(anio, 0, 1, 12));
  const semana = 1 + Math.floor((jueves.getTime() - primeroDeEnero.getTime()) / (7 * 86_400_000));
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

export function claveMes(dia: string): string {
  return dia.slice(0, 7);
}

export function diasDelMes(dia: string): number {
  const [a, m] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** El mismo día del mes anterior (o el último, si el mes anterior es más corto). */
export function mismoDiaMesAnterior(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const anterior = new Date(Date.UTC(a, m - 2, 1, 12));
  const ultimo = new Date(Date.UTC(anterior.getUTCFullYear(), anterior.getUTCMonth() + 1, 0)).getUTCDate();
  anterior.setUTCDate(Math.min(d, ultimo));
  return aDia(anterior);
}

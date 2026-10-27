// Fechas como se escriben en Argentina: día primero.

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Si el día existe en ese mes ("31/02" no). */
function valida(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
}

function iso(a: number, m: number, d: number): string | null {
  return valida(a, m, d) ? `${a}-${dosDigitos(m)}-${dosDigitos(d)}` : null;
}

/**
 * Cuando la fecha no trae año ("12/10"), se asume el año en curso; si así
 * quedara en el futuro, es del año anterior: son gastos que ya pasaron.
 */
function conAnioProbable(m: number, d: number, hoy: string): string | null {
  const anio = Number(hoy.slice(0, 4));
  const esteAnio = iso(anio, m, d);
  if (esteAnio && esteAnio <= hoy) return esteAnio;
  return iso(anio - 1, m, d);
}

const anioDe = (n: number) => (n < 100 ? 2000 + n : n);

/** Un serial de fecha de Excel (días desde 1899-12-30) a 'YYYY-MM-DD'. */
export function fechaDeSerialExcel(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Una fecha escrita de cualquiera de las formas habituales, a 'YYYY-MM-DD'; null si no se entiende. */
export function parsearFecha(crudo: string, hoy: string): string | null {
  const t = crudo.trim().toLowerCase();
  if (!t) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t\s].*)?$/.exec(t);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})(?:\s.*)?$/.exec(t);
  if (m) return iso(anioDe(Number(m[3])), Number(m[2]), Number(m[1]));

  m = /^(\d{1,2})[/\-.](\d{1,2})$/.exec(t);
  if (m) return conAnioProbable(Number(m[2]), Number(m[1]), hoy);

  // "12 oct", "12 de octubre", "12 de octubre de 2025"
  m = /^(\d{1,2})\s*(?:de\s+)?([a-zñ]+)\.?(?:\s*(?:de\s+)?(\d{4}))?$/.exec(t);
  if (m && MESES[m[2]]) {
    const dia = Number(m[1]);
    const mes = MESES[m[2]];
    return m[3] ? iso(Number(m[3]), mes, dia) : conAnioProbable(mes, dia, hoy);
  }
  return null;
}

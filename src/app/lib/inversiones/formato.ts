// Formato de porcentajes y fechas para el copy de inversiones.
// Convención argentina: coma decimal. Los porcentajes se escriben siempre con
// el signo cuando comparan contra la inflación ("−0,3%"), porque ahí el signo
// es el dato.

const MENOS = '−';

export function pct(n: number, decimales = 1): string {
  const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${n < 0 && Number(abs.replace(',', '.')) !== 0 ? MENOS : ''}${abs}%`;
}

/** Con signo explícito: +1,2% / −0,3%. */
export function pctConSigno(n: number, decimales = 1): string {
  const base = pct(n, decimales);
  // "+0,0%" no dice nada: si redondea a cero, va sin signo.
  const esCero = Number(base.replace(MENOS, '').replace('%', '').replace(',', '.')) === 0;
  return n > 0 && !esCero && !base.startsWith(MENOS) ? `+${base}` : base;
}

/** Una fracción (0.21) como porcentaje (21%). */
export function pctDeFraccion(f: number, decimales = 1): string {
  return pct(f * 100, decimales);
}

/** "entre 19,0% y 21,0%" o, si el rango es angosto, un solo valor. */
export function rangoPct(min: number, max: number, decimales = 1, esFraccion = true): string {
  const a = esFraccion ? min * 100 : min;
  const b = esFraccion ? max * 100 : max;
  const sa = pct(a, decimales);
  const sb = pct(b, decimales);
  return sa === sb ? sa : `entre ${sa} y ${sb}`;
}

/** Igual que `rangoPct` pero con signo explícito: "entre −0,3% y +0,1%". */
export function rangoPctConSigno(min: number, max: number, decimales = 1, esFraccion = true): string {
  const a = esFraccion ? min * 100 : min;
  const b = esFraccion ? max * 100 : max;
  const sa = pctConSigno(a, decimales);
  const sb = pctConSigno(b, decimales);
  return sa === sb ? sa : `entre ${sa} y ${sb}`;
}

export function enMeses(m: number): string {
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const anios = m / 12;
  return Number.isInteger(anios) ? `${anios} ${anios === 1 ? 'año' : 'años'}` : `${m} meses`;
}

export function listaConY(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Redondea un monto a un número "humano" (múltiplo de 1.000, mínimo 1.000). */
export function redondearMonto(n: number): number {
  return Math.max(1000, Math.round(n / 1000) * 1000);
}

/** "$1.250.000" — el mismo formato que usa el resto de la app, sin depender de un componente. */
export function fmtPesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

/** "21/10" desde 'YYYY-MM-DD'. */
export function diaMes(fecha: string): string {
  const [, m, d] = fecha.split('-');
  return d && m ? `${d}/${m}` : fecha;
}

const SIGLAS = new Set(['BBVA', 'CMF', 'ICBC', 'HSBC', 'BICA', 'VOII', 'REBA', 'BNA', 'IOL', 'CVU', 'CBU']);
const MINUSCULAS = new Set(['de', 'del', 'la', 'y', 'e', 'los', 'las']);

/** "BANCO DE GALICIA Y BUENOS AIRES S.A." → "Banco de Galicia y Buenos Aires S.A." */
export function nombrePropio(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const bajo = w.toLowerCase();
      if (SIGLAS.has(w.toUpperCase()) || w.includes('.')) return w.toUpperCase();
      if (i > 0 && MINUSCULAS.has(bajo)) return bajo;
      return bajo.charAt(0).toUpperCase() + bajo.slice(1);
    })
    .join(' ');
}

/** Nombres de cuentas como los conoce la gente. */
export function nombreCuenta(id: string): string {
  const mapa: Record<string, string> = {
    UALA: 'Ualá', 'UALA PLUS 1': 'Ualá Plus 1', 'UALA PLUS 2': 'Ualá Plus 2', 'NARANJA X': 'Naranja X', BRUBANK: 'Brubank',
  };
  return mapa[id] ?? nombrePropio(id);
}

// Montos como se escriben en Argentina: "$ 8.500", "8.500,50", "US$ 20", "-1.234".

export type MontoLeido = { monto: number; moneda: 'ARS' | 'USD' };

/** Un número escrito con puntos y comas, o null si no es un número. */
export function parsearNumero(crudo: string): number | null {
  let t = crudo.trim().replace(/\s+/g, '');
  if (!t) return null;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-') || t.endsWith('-');
  t = t.replace(/^[(-]+|[)-]+$/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;

  const ultimoPunto = t.lastIndexOf('.');
  const ultimaComa = t.lastIndexOf(',');
  let normal: string;
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // Los dos: el último es el decimal.
    const decimal = ultimoPunto > ultimaComa ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    normal = t.split(miles).join('').replace(decimal, '.');
  } else if (ultimaComa >= 0) {
    // Sólo comas: "8,5" y "8,50" son decimales; "8,500" y "1,234,567" son miles.
    const partes = t.split(',');
    normal = partes.length === 2 && partes[1].length <= 2 ? `${partes[0]}.${partes[1]}` : partes.join('');
  } else if (ultimoPunto >= 0) {
    // Sólo puntos: en Argentina "8.500" son miles; "8.5" y "8.50" son decimales.
    const partes = t.split('.');
    const todosDeTres = partes.slice(1).every((p) => p.length === 3);
    normal = partes.length > 2 || todosDeTres ? partes.join('') : t;
  } else {
    normal = t;
  }
  const n = Number(normal);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** El monto de una celda o de un trozo de texto: con su signo de moneda, si lo trae. Siempre en positivo. */
export function parsearMonto(crudo: string | number | null): MontoLeido | null {
  if (crudo === null) return null;
  if (typeof crudo === 'number') return Number.isFinite(crudo) && crudo !== 0 ? { monto: Math.abs(crudo), moneda: 'ARS' } : null;
  const dolar = /(?:us\s?\$|u\$s|usd|dólares|dolares|\bdls\b)/i.test(crudo);
  const limpio = crudo.replace(/(?:us\s?\$|u\$s|usd|ars|dólares|dolares|pesos|\bdls\b|\$)/gi, '').trim();
  const n = parsearNumero(limpio);
  if (n === null || n === 0) return null;
  return { monto: Math.abs(n), moneda: dolar ? 'USD' : 'ARS' };
}

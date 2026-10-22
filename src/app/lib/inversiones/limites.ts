// Qué hay que decidir para hacer cada inversión, en qué moneda, y qué mínimos y
// máximos tiene. Es la fuente única para que lo que se pregunta al EMPEZAR (el
// paso a paso) y lo que se pregunta al REGISTRAR sean lo mismo: si para comprar
// un CEDEAR hay que elegir cuántos, el registro pregunta cuántos y a qué precio;
// si para una cuenta alcanza con un monto, el registro pregunta el monto.

import type { ProductoId, ProveedorId } from './catalogo.js';
import { fmtPesos } from './formato.js';
import type { Mercado } from './mercadoTipos.js';

/**
 * Cómo se decide cuánto invertir:
 *  · monto — un monto en pesos (cuenta, fondo).
 *  · monto_plazo — un monto y por cuántos días (plazo fijo).
 *  · cantidad — cuántas unidades de algo que tiene precio (CEDEARs).
 *  · dolares — pesos o dólares, a elección (dólar MEP).
 */
export type Entrada = 'monto' | 'monto_plazo' | 'cantidad' | 'dolares';

export function entradaDe(producto: ProductoId): Entrada {
  switch (producto) {
    case 'plazo_fijo':
    case 'plazo_fijo_uva':
      return 'monto_plazo';
    case 'cedear':
      return 'cantidad';
    case 'dolar':
      return 'dolares';
    default:
      return 'monto';
  }
}

/** Los plazos que se ofrecen, en días. El UVA arranca en 90 (el mínimo que se exige). */
export function plazosDe(producto: ProductoId): number[] {
  return producto === 'plazo_fijo_uva' ? [90, 180, 365] : [30, 60, 90];
}

// ── Listas predeterminadas ───────────────────────────────────────────────
export type CedearDisponible = { ticker: string; nombre: string; explicacion: string };

/**
 * Los CEDEARs que se ofrecen. Son los más conocidos y los que cotizan en los dos
 * brokers que cubrimos; la lista es igual para ambos.
 */
export const CEDEARS_DISPONIBLES: CedearDisponible[] = [
  { ticker: 'SPY', nombre: 'S&P 500', explicacion: 'Las 500 empresas más grandes de EE.UU., en un solo paquete (un ETF)' },
  { ticker: 'QQQ', nombre: 'Nasdaq 100', explicacion: 'Las 100 empresas de tecnología más grandes de EE.UU., en un solo paquete (un ETF)' },
  { ticker: 'AAPL', nombre: 'Apple', explicacion: 'Apple (iPhone, Mac)' },
  { ticker: 'MSFT', nombre: 'Microsoft', explicacion: 'Microsoft (Windows, Office)' },
  { ticker: 'GOOGL', nombre: 'Google', explicacion: 'Google (el buscador, YouTube)' },
  { ticker: 'AMZN', nombre: 'Amazon', explicacion: 'Amazon (compras online, servidores)' },
  { ticker: 'META', nombre: 'Meta', explicacion: 'Meta (Instagram, WhatsApp, Facebook)' },
  { ticker: 'NVDA', nombre: 'Nvidia', explicacion: 'Nvidia (chips para inteligencia artificial)' },
  { ticker: 'TSLA', nombre: 'Tesla', explicacion: 'Tesla (autos eléctricos)' },
  { ticker: 'KO', nombre: 'Coca-Cola', explicacion: 'Coca-Cola' },
  { ticker: 'MELI', nombre: 'Mercado Libre', explicacion: 'Mercado Libre' },
];

export const explicarTicker =
  'El ticker es el código corto de cada inversión, como un apodo. Por ejemplo, SPY es el de las 500 empresas más grandes de EE.UU.';

/** Los fondos de dinero que ofrece cada proveedor. `id` es el nombre en CAFCI (el organismo que los lista). */
export const FONDOS_POR_PROVEEDOR: Partial<Record<ProveedorId, { id: string; nombre: string }>> = {
  mercado_pago: { id: 'Mercado Fondo - Clase A', nombre: 'Mercado Fondo' },
  cocos: { id: 'Cocos Ahorro - Clase A', nombre: 'Cocos Ahorro' },
  balanz: { id: 'Balanz Capital Money Market - Clase A', nombre: 'Balanz Capital Money Market' },
};

// ── Mínimos y máximos ────────────────────────────────────────────────────
export type Limites = {
  /** Lo mínimo para hacerlo. null = no hay un mínimo que conozcamos. */
  min: number | null;
  /** true = por debajo de esto no se puede (un CEDEAR cuesta lo que cuesta); false = se puede, pero no rinde esa tasa. */
  minDuro: boolean;
  /** Hasta cuánto rinde la tasa publicada. */
  max: number | null;
  textoMin: string | null;
  textoMax: string | null;
};

const SIN_LIMITES: Limites = { min: null, minDuro: false, max: null, textoMin: null, textoMax: null };

const pesosDe = (s: string): number => Number(s.replace(/\./g, '').replace(',', '.'));

/** El precio de un CEDEAR hoy, o null si no lo tenemos. */
export function precioCedear(m: Mercado | null, ticker: string): number | null {
  return m?.cedears?.valor.find((c) => c.simbolo === ticker)?.precio ?? null;
}

export function limitesDe(
  producto: ProductoId, proveedor: ProveedorId, m: Mercado | null, ticker?: string,
): Limites {
  if (producto === 'cedear') {
    const precio = precioCedear(m, ticker ?? 'SPY');
    if (!precio) return SIN_LIMITES;
    return {
      min: precio, minDuro: true, max: null,
      textoMin: `Mínimo: ${fmtPesos(precio)}, lo que cuesta hoy uno solo (no se pueden comprar pedacitos de un CEDEAR).`,
      textoMax: null,
    };
  }

  if (producto === 'cuenta_remunerada') {
    const id = proveedor === 'uala' ? 'UALA' : proveedor === 'naranja_x' ? 'NARANJA X' : null;
    const c = id ? m?.cuentas?.valor.find((x) => x.id === id) : undefined;
    if (!c) return SIN_LIMITES;
    const minimo = /entre \$\s?([\d.]+)/i.exec(c.condiciones);
    const min = minimo ? pesosDe(minimo[1]) : null;
    return {
      min,
      minDuro: false,
      max: c.tope,
      textoMin: min ? `Para que rinda esa tasa, tenés que tener al menos ${fmtPesos(min)} en la cuenta.` : null,
      textoMax: c.tope ? `La tasa rinde hasta ${fmtPesos(c.tope)} de saldo. Lo que pase de ahí rinde menos o nada.` : null,
    };
  }
  return SIN_LIMITES;
}

/** Un mensaje si el monto no cumple el mínimo (o se pasa del máximo); null si está bien. */
export function avisoDeMonto(l: Limites, monto: number | null): { texto: string; bloquea: boolean } | null {
  if (!monto) return null;
  if (l.min !== null && monto < l.min && l.textoMin) return { texto: l.textoMin, bloquea: l.minDuro };
  if (l.max !== null && monto > l.max && l.textoMax) return { texto: l.textoMax, bloquea: false };
  return null;
}

// ── Tasas declaradas por las personas ────────────────────────────────────
/** La clave con la que se agrupan las tasas declaradas: 'fci|Mercado Pago|Mercado Fondo'. */
export const claveDeclarada = (tipo: 'cuenta_remunerada' | 'fci', lugar: string, fondo = ''): string => `${tipo}|${lugar}|${fondo}`;

/** De dónde sale la tasa declarada para este producto en este proveedor, o null si no aplica. */
export function origenDeclarable(
  producto: ProductoId, proveedor: ProveedorId, nombreProveedor: string,
): { tipo: 'cuenta_remunerada' | 'fci'; lugar: string; fondo: string } | null {
  if (producto === 'cuenta_remunerada') {
    // La cuenta de Mercado Pago es un fondo (Mercado Fondo): se declara como fondo.
    if (proveedor === 'mercado_pago') return { tipo: 'fci', lugar: nombreProveedor, fondo: FONDOS_POR_PROVEEDOR.mercado_pago?.nombre ?? '' };
    return { tipo: 'cuenta_remunerada', lugar: nombreProveedor, fondo: '' };
  }
  if (producto === 'fci') return { tipo: 'fci', lugar: nombreProveedor, fondo: FONDOS_POR_PROVEEDOR[proveedor]?.nombre ?? '' };
  return null;
}

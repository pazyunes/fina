// Bancos, billeteras y cuentas: cuáles se ofrecen, en qué orden y cuál se marca como "recomendado".
//
// El orden siempre es por lo que rinde, de mayor a menor. Se marca como recomendada la entidad que la
// persona ya usa (por lo que contó en el perfil o por los medios de pago que cargó): así se ahorra el
// paso de abrir una cuenta. Todo es función pura, sin red ni React.

import type { ProveedorId } from './catalogo.js';
import { nombreCuenta, nombrePropio } from './formato.js';
import { bancosOrdenados, temDeTna } from './motor.js';
import type { Mercado } from './mercadoTipos.js';

const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palabras que no distinguen a un banco de otro ("Banco de la Nación Argentina" y "BNA" se parecen por "Nación"). */
const GENERICAS = new Set(['banco', 'bank', 'argentina', 'argentino', 'buenos', 'aires', 'compania', 'financiera', 'cuenta', 'positiva', 'plus', 'sa', 'de', 'la', 'del', 'el', 'los', 'y']);

const ALIAS: Record<string, string[]> = {
  bna: ['nacion'], bbva: ['bbva', 'frances'], galicia: ['galicia'], santander: ['santander', 'rio'], macro: ['macro'], icbc: ['icbc'],
  brubank: ['brubank'], uala: ['uala'], naranja: ['naranja'], mercadopago: ['mercado', 'pago'],
};

/** Las palabras que distinguen a una entidad: sin tildes, en minúscula y sin las genéricas. */
export function palabrasDe(s: string): string[] {
  const t = sinTildes(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 2 && !GENERICAS.has(w));
  const extra = t.flatMap((w) => ALIAS[w] ?? []);
  return [...new Set([...t, ...extra])];
}

/** ¿Es la misma entidad? Alcanza con que compartan una palabra distintiva ("Galicia" con "Banco de Galicia y Buenos Aires"). */
export function coincideEntidad(a: string, b: string): boolean {
  const pa = palabrasDe(a);
  const pb = palabrasDe(b);
  return pa.some((w) => w.length >= 3 && pb.includes(w));
}

/** La primera entidad de la lista que la persona ya usa, o null. */
export function entidadQueUsa(propias: string[], entidades: string[]): string | null {
  return entidades.find((e) => propias.some((p) => coincideEntidad(p, e))) ?? null;
}

/** UALA PLUS 1 → UALA; NARANJA X FRASCOS 7-13 → NARANJA X; BICA CUENTA POSITIVA 3 → BICA. */
const baseDe = (id: string): string => id.replace(/ (PLUS \d+|FRASCOS .*|CUENTA POSITIVA \d+)$/, '');

/** Los nombres de las cuentas remuneradas que conocemos, para elegir al registrar. */
export function nombresDeCuentas(m: Mercado | null): string[] {
  const nombres = new Set<string>(['Mercado Pago']);
  for (const c of m?.cuentas?.valor ?? []) {
    const base = baseDe(c.id);
    if (c.tna > 0 || base !== c.id) nombres.add(nombreCuenta(base));
  }
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
}

// ── plazo fijo ───────────────────────────────────────────────────────────
export type OpcionBanco = {
  /** Tal cual figura en el BCRA (es lo que se guarda). */
  entidad: string;
  nombre: string;
  /** TNA a 30 días (fracción). null si no se publica. */
  tna: number | null;
  /** Lo que suma sobre la UVA, si el banco lo publica. */
  extraUva: number | null;
  recomendado: boolean;
};

/** Lo que suma sobre la UVA un banco para este plazo (fracción), o null si no lo publica. */
export function extraUva(m: Mercado | null, banco: string | null, plazoDias: number | null): number | null {
  if (!m?.plazoFijoUva || !banco) return null;
  const b = m.plazoFijoUva.valor.find((x) => coincideEntidad(x.entidad, banco) && coincideEntidad(banco, x.entidad));
  if (!b) return null;
  const t = plazoDias ? b.tasas.find((x) => x.plazoMinDias <= plazoDias && x.plazoMaxDias >= plazoDias) : b.tasas[0];
  return t ? t.tna : null;
}

/**
 * Los bancos para elegir, de la mayor tasa a la menor; el que la persona ya usa va marcado y primero.
 * En el plazo fijo UVA no hay una tasa para ordenar (sólo la publican algunos): primero los que la publican, y el resto por nombre.
 */
export function bancosParaPlazoFijo(m: Mercado, uva: boolean, propias: string[]): OpcionBanco[] {
  const base = bancosOrdenados(m).map((b): OpcionBanco => ({
    entidad: b.entidad, nombre: nombrePropio(b.entidad), tna: uva ? null : b.tna, extraUva: extraUva(m, b.entidad, 90), recomendado: false,
  }));
  const ordenadas = uva
    ? [...base].sort((a, b) => ((b.extraUva ?? -1) - (a.extraUva ?? -1)) || a.nombre.localeCompare(b.nombre, 'es'))
    : base;
  const suyo = entidadQueUsa(propias, ordenadas.map((o) => o.entidad));
  return ordenadas
    .map((o) => ({ ...o, recomendado: o.entidad === suyo }))
    .sort((a, b) => Number(b.recomendado) - Number(a.recomendado));
}

// ── cuenta remunerada ────────────────────────────────────────────────────
export type OpcionCuenta = {
  /** El id de la cuenta base en los datos (UALA, BRUBANK…) o 'MERCADO PAGO'. */
  id: string;
  nombre: string;
  /** Lo que paga sin condiciones (TNA, fracción). */
  tna: number;
  /** Lo máximo que puede llegar a pagar cumpliendo condiciones. */
  techo: number;
  tope: number | null;
  condiciones: string;
  proveedor: ProveedorId;
  /** Rinde menos que la inflación aun en su mejor nivel. */
  pierde: boolean;
  recomendado: boolean;
};

const PROVEEDOR_DE: Record<string, ProveedorId> = { UALA: 'uala', 'NARANJA X': 'naranja_x', 'MERCADO PAGO': 'mercado_pago' };

/**
 * Las cuentas remuneradas para elegir (billeteras y bancos), de la que más rinde a la que menos. Los niveles de
 * una misma cuenta (Ualá, Ualá Plus 1…) se juntan en una. Las que no rinden nada no se ofrecen.
 */
export function cuentasParaElegir(m: Mercado, inflacionMensual: number, propias: string[]): OpcionCuenta[] {
  const grupos = new Map<string, NonNullable<Mercado['cuentas']>['valor']>();
  for (const c of m.cuentas?.valor ?? []) {
    const b = baseDe(c.id);
    grupos.set(b, [...(grupos.get(b) ?? []), c]);
  }
  const lista: OpcionCuenta[] = [];
  for (const [id, filas] of grupos) {
    const techo = Math.max(...filas.map((f) => f.tna));
    if (techo <= 0) continue;
    const base = filas.find((f) => f.id === id) ?? filas.reduce((a, f) => (f.tna > a.tna ? f : a), filas[0]);
    lista.push({
      id, nombre: nombreCuenta(id), tna: base.tna, techo, tope: base.tope, condiciones: base.condiciones, proveedor: PROVEEDOR_DE[id] ?? 'otra_cuenta',
      pierde: temDeTna(techo) < inflacionMensual, recomendado: false,
    });
  }
  // Mercado Pago no publica una tasa: es un fondo. Se muestra con lo que rindió el último mes (o el último día).
  const mp = m.fondos?.valor.find((f) => f.id === 'Mercado Fondo - Clase A');
  const tnaMp = mp ? (mp.tna30 ?? mp.tna7 ?? mp.tna1) : null;
  if (tnaMp !== null && tnaMp > 0) {
    lista.push({ id: 'MERCADO PAGO', nombre: 'Mercado Pago', tna: tnaMp, techo: tnaMp, tope: null, condiciones: '', proveedor: 'mercado_pago', pierde: temDeTna(tnaMp) < inflacionMensual, recomendado: false });
  }
  lista.sort((a, b) => b.techo - a.techo);
  const suyo = entidadQueUsa(propias, lista.map((o) => o.nombre));
  return lista.map((o) => ({ ...o, recomendado: o.nombre === suyo })).sort((a, b) => Number(b.recomendado) - Number(a.recomendado));
}

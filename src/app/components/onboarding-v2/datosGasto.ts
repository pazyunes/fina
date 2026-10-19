import { COLORS, fmtMoney } from './shared';
import type { EstadoV2, PagoMixto } from '../../api/v2/tipos';

// Tipos y cálculos de los gastos que comparten Gastos, Todos tus gastos, Tus
// secciones, el formulario de gasto y la torta de Inicio. Sin JSX: es lógica.

export type TipoGasto = 'urgente' | 'impulsivo' | 'necesario' | 'otro';
export type Moneda = 'ARS' | 'USD';
export type Periodo = 'semana' | 'mes';
export type Tope = { monto: number; periodo: Periodo };
export type Categoria = { id: string; nombre: string };
export type Gasto = { id: string; monto: number; montoArs: number; moneda: Moneda; descripcion: string; categoriaId: string; tipo: TipoGasto; tipoOtro?: string; ts: number; metodoPago?: string; pagos?: PagoMixto[]; origen: 'web' | 'whatsapp' | 'manual' };

// El "tipo de gasto" es una CLASIFICACIÓN que eligió la persona, no un juicio.
// En pantalla va sin color (decisión oct 2026: los colores son sólo de las
// secciones); el color de abajo queda por si se vuelve a usar.
export const TIPO_INFO: Record<TipoGasto, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: COLORS.lila },
  // Se guarda 'impulsivo' (el dato no cambia), pero se dice "Gusto":
  // "impulsivo" juzga el gasto y la app no moraliza el consumo (regla 3).
  impulsivo: { label: 'Gusto', color: COLORS.gold },
  necesario: { label: 'Necesario', color: COLORS.green },
  otro: { label: 'Otro', color: COLORS.sky },
};
export const TIPOS: TipoGasto[] = ['necesario', 'urgente', 'impulsivo', 'otro'];

/**
 * Los gastos del almacén como los muestra la app. Si un gasto llegó sin
 * descripción, o con una variable sin completar del bot
 * ("{{vars.expense_description}}"), se muestra el nombre de la sección: un
 * renglón vacío o con código no dice qué gasto es.
 */
export function gastosDeLaBase(db: EstadoV2): Gasto[] {
  return db.gastos.map((g) => ({
    id: g.id,
    monto: g.monto,
    montoArs: g.montoArs,
    moneda: g.moneda,
    descripcion: !g.descripcion.trim() || /\{\{.*\}\}/.test(g.descripcion)
      ? (db.secciones.find((s) => s.id === g.seccionId)?.nombre ?? 'Gasto sin descripción')
      : g.descripcion,
    categoriaId: g.seccionId ?? '',
    tipo: g.tipo,
    tipoOtro: g.tipoOtro,
    ts: g.ts,
    metodoPago: g.metodoPago ?? undefined,
    pagos: g.pagos,
    origen: g.origen,
  }));
}

/** Las secciones con su tope, como las usan las pantallas de gastos. */
export function seccionesDeLaBase(db: EstadoV2): { categorias: Categoria[]; topes: Record<string, Tope> } {
  return {
    categorias: db.secciones.map((s) => ({ id: s.id, nombre: s.nombre })),
    topes: Object.fromEntries(db.secciones.filter((s) => s.tope !== null).map((s) => [s.id, s.tope as Tope])),
  };
}

// Hues categóricos por sección, para el anillo, la torta de Inicio y el punto
// de cada gasto. Los montos nunca toman estos colores: siempre tinta neutral.
// Seis colores bien distintos entre sí: con violetas parecidos, con seis
// secciones la mitad de la rueda terminaba emparentada.
const CAT_COLORS = [COLORS.brand, COLORS.naranja, COLORS.star, COLORS.lima, COLORS.azul, COLORS.magenta];

/** El color de una sección, atado al orden en que se creó: no cambia si cambia lo gastado. */
export function colorDeSeccion(id: string, categorias: Categoria[]): string {
  const i = categorias.findIndex((c) => c.id === id);
  return i < 0 ? COLORS.lineStrong : CAT_COLORS[i % CAT_COLORS.length];
}

/** Inicio del mes en curso: las listas de secciones muestran lo gastado este mes. */
export function inicioDelMes(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// Cada gasto guarda DOS montos: `monto` es lo que la persona tipeó, en su
// moneda, y `montoArs` su equivalente en pesos congelado a la cotización de
// ese día. La fila muestra `monto` con su signo (US$20, porque eso es lo que
// pasó); todo lo que SUMA usa `montoArs`.
export function fmtGasto(g: { monto: number; moneda: Moneda }): string {
  return g.moneda === 'USD' ? `US$${g.monto.toLocaleString('es-AR')}` : fmtMoney(g.monto);
}
export function fmtPagos(pagos: PagoMixto[]): string {
  return pagos.map((p) => `${p.medio} (${fmtMoney(p.monto)})`).join(' + ');
}

// Lo que la persona escribió antes en un "otro", sin repetir (ignora
// mayúsculas), del más reciente al más viejo. Sale de los propios movimientos:
// no hay tabla aparte. Los movimientos ya vienen ordenados del más nuevo al más
// viejo, así que alcanza con quedarse con la primera aparición de cada texto.
export function recientes(valores: (string | undefined)[], max = 6): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const v of valores) {
    const t = v?.trim();
    if (!t || vistos.has(t.toLowerCase())) continue;
    vistos.add(t.toLowerCase());
    salida.push(t);
    if (salida.length >= max) break;
  }
  return salida;
}

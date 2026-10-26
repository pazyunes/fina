import type { EstadoV2, Objetivo } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// La plata apartada: lo que la persona separó para algo y deja de estar libre
// para gastar (migración 0043).
//
// Sale de los registros de cada objetivo:
//   · en un objetivo de AHORRO, todo lo separado ('saved') queda apartado
//     mientras el objetivo exista: la plata sigue siendo suya, pero ya tiene
//     destino;
//   · en un GASTO que se viene, lo separado menos lo que ya se usó para pagarlo
//     ('paid'). Al pagar se registra un 'paid' por lo que estaba apartado, así
//     lo libre no baja dos veces: bajó al apartar, y el gasto lo reemplaza.
//
// La "plata apartada" suelta del perfil (la reserva) se informa aparte pero no
// entra al total: dejó de verse en Mis planes (oct 2026), y restar del
// disponible algo que no se ve en ningún lado sería un número sin explicación.
//
// Todo en pesos, con el equivalente congelado de cada registro.
// ─────────────────────────────────────────────────────────────────────────

const enPesos = (c: Objetivo['contribuciones'][number]) => c.montoArs ?? (c.moneda === 'ARS' ? c.monto : 0);

/** Lo apartado hoy para un objetivo o un gasto que se viene, en pesos. */
export function apartadoDe(o: Objetivo): number {
  if (o.estado === 'cancelled') return 0;
  const separado = o.contribuciones.filter((c) => c.kind === 'saved').reduce((t, c) => t + enPesos(c), 0);
  if (o.clase !== 'gasto') return separado;
  // Un gasto que ya se pagó y no se repite no retiene nada.
  if (o.estado === 'achieved' && !o.repite) return 0;
  const usado = o.contribuciones.filter((c) => c.kind === 'paid').reduce((t, c) => t + enPesos(c), 0);
  return Math.max(separado - usado, 0);
}

export type Apartado = {
  /** Todo lo apartado, en pesos. */
  total: number;
  /** Para lo que ya sabe que va a gastar. */
  paraGastos: number;
  /** Para sus objetivos de ahorro. */
  paraAhorro: number;
  /** La reserva suelta del perfil, sin destino puntual. No entra en `total`. */
  sinDestino: number;
};

export function apartadoTotal(e: EstadoV2): Apartado {
  let paraGastos = 0;
  let paraAhorro = 0;
  for (const o of e.objetivos) {
    const a = apartadoDe(o);
    if (o.clase === 'gasto') paraGastos += a; else paraAhorro += a;
  }
  const sinDestino = Math.max(e.perfil.reserva, 0);
  return { total: paraGastos + paraAhorro, paraGastos, paraAhorro, sinDestino };
}

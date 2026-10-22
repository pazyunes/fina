import { avisarConfirmacion, encolar, estaHidratado, leerEstado, parchearEstado } from './almacen';
import { cotizacionDolar } from './cotizacion';
import * as api from './index';
import { idUsuaria } from './cliente';
import type {
  AporteInversion, Carga, Contribucion, FuenteIngreso, Gasto, GastoFijo, Grupo, Ingreso, Moneda, MonedaConvertible,
  Objetivo, PagoMixto, Perfil, PerfilInversor, Periodo, PosicionInversion, Seccion, TipoGasto,
} from './tipos';
import { esConvertible } from './tipos';
import { siguienteVencimiento } from './fechasFijos';

// ─────────────────────────────────────────────────────────────────────────
// Acciones: lo que las pantallas llaman cuando la persona hace algo.
//
// Cada una hace lo mismo en el mismo orden:
//   1. actualiza la copia en memoria (la interfaz responde en el frame)
//   2. encola la escritura contra Supabase (la verdad)
//
// Este archivo existe para que `index.ts` se quede siendo sólo Supabase y
// `almacen.ts` sólo la copia: acá viven las dos cosas juntas, que es lo que
// las pantallas necesitan. Sin esta capa, `index` tendría que importar
// `almacen` y `almacen` ya importa `index` — un ciclo.
//
// El id se genera acá y viaja al insert, así el id de la fila nueva es el
// mismo desde el primer render.
// ─────────────────────────────────────────────────────────────────────────

export function nuevoId(): string {
  // randomUUID no existe en contextos no seguros (http:// que no sea
  // localhost). El respaldo no tiene que ser criptográfico: sólo único.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

/** Sólo escribe si hay sesión hidratada. Ver `sincronizar` en shared.tsx. */

/**
 * Encola una escritura. Si se pasa `confirmacion`, se muestra ese mensaje
 * cuando la base CONFIRMA que se hizo — nunca antes. Si falla, no hay
 * confirmación: lo cuenta el cartel de error del layout, y `siFalla` deshace lo
 * que se había pintado de antemano (por ejemplo, vuelve a mostrar el gasto que
 * no se pudo borrar).
 *
 * Los carteles dicen SÓLO que la acción se hizo ("Gasto borrado con éxito").
 * Nada de consecuencias ("la plata volvió a Mercado Pago"): el cartel confirma
 * lo que pasó en la base, y cualquier otra cosa que diga es una afirmación que
 * puede no ser cierta.
 */
function push(fn: () => Promise<{ data: unknown; error: string | null }>, confirmacion?: string, siFalla?: () => void) {
  if (!estaHidratado()) return;
  let salioBien = false;
  void encolar(async () => {
    const r = await fn();
    salioBien = r.error === null;
    return r;
  }).then(() => {
    if (salioBien && confirmacion) avisarConfirmacion(confirmacion);
    if (!salioBien && siFalla) siFalla();
  });
}

// ── Perfil ───────────────────────────────────────────────────────────────
export function guardarPerfil(parche: Partial<Perfil>, confirmacion?: string) {
  parchearEstado({ perfil: { ...leerEstado().perfil, ...parche } });
  push(() => api.guardarPerfil(parche), confirmacion);
}

// ── Secciones ────────────────────────────────────────────────────────────
export function crearSeccion(nombre: string): Seccion {
  const seccion: Seccion = { id: nuevoId(), nombre: nombre.trim(), slug: '', tope: null };
  parchearEstado({ secciones: [...leerEstado().secciones, seccion] });
  push(() => api.crearSeccion(seccion.nombre, seccion.id));
  return seccion;
}

export function renombrarSeccion(id: string, nombre: string) {
  parchearEstado({
    secciones: leerEstado().secciones.map((s) => (s.id === id ? { ...s, nombre } : s)),
  });
  push(() => api.renombrarSeccion(id, nombre), 'Sección renombrada con éxito.');
}

export function guardarTope(id: string, tope: { monto: number; periodo: Periodo } | null) {
  parchearEstado({
    secciones: leerEstado().secciones.map((s) => (s.id === id ? { ...s, tope } : s)),
  });
  push(() => api.guardarTope(id, tope), tope ? 'Tope guardado con éxito.' : 'Tope eliminado con éxito.');
}

export function borrarSeccion(id: string) {
  const est = leerEstado();
  parchearEstado({
    secciones: est.secciones.filter((s) => s.id !== id),
    // Los gastos NO se borran: la sección desaparece, la plata que se gastó
    // sigue habiendo pasado. Quedan sin sección, igual que en la base
    // (`on delete set null`).
    gastos: est.gastos.map((g) => (g.seccionId === id ? { ...g, seccionId: null } : g)),
  });
  push(() => api.borrarSeccion(id), 'Sección borrada con éxito.');
}

// Una sección que VOS vaciaste (le quedaba un solo gasto y lo borraste, o lo
// moviste a otra sección) desaparece sola — ya no tiene sentido una sección
// fantasma con un tope puesto y nada adentro. Las que arma el onboarding y
// todavía nadie tocó NO entran acá: nunca pasan de 1 gasto a 0, porque nunca
// llegaron a tener ninguno, así que se quedan esperando el primero.
function borrarSeccionSiQuedoVacia(seccionId: string | null, gastosAntes: Gasto[], gastosDespues: Gasto[]) {
  if (!seccionId) return;
  const habiaUno = gastosAntes.filter((g) => g.seccionId === seccionId).length === 1;
  const quedaCero = !gastosDespues.some((g) => g.seccionId === seccionId);
  if (habiaUno && quedaCero) borrarSeccion(seccionId);
}

// ── Medios de pago ───────────────────────────────────────────────────────
export function sumarDisponible(medio: string, monto: number) {
  const nombre = medio.trim() || 'Efectivo';
  const est = leerEstado();
  const existe = est.mediosPago.find((m) => m.nombre === nombre);
  const ahora = new Date().toISOString();
  // Además de mover el saldo, la carga se anota con su fecha: es lo que permite
  // que "Dinero disponible" sea de cada mes.
  const carga: Carga = { id: nuevoId(), medio: nombre, montoArs: monto, ts: Date.now() };
  parchearEstado({
    mediosPago: existe
      ? est.mediosPago.map((m) => (m.nombre === nombre ? { ...m, saldo: m.saldo + monto, usadoEn: ahora } : m))
      : [{ id: nuevoId(), nombre, saldo: monto, usadoEn: ahora }, ...est.mediosPago],
    cargas: [carga, ...est.cargas],
  });
  push(() => api.sumarDisponible(nombre, monto), 'Dinero agregado con éxito.');
  push(() => api.registrarCarga(carga));
}

/**
 * Une el medio `origen` en `destino`. En pantalla, igual que en la base: el
 * origen desaparece, el destino se queda con la suma de los saldos y todo lo
 * que decía "origen" pasa a decir "destino".
 */
export function unirMedios(origen: string, destino: string) {
  const o = origen.trim();
  const d = destino.trim();
  if (!o || !d || o === d) return;
  const est = leerEstado();
  const saldoO = est.mediosPago.find((m) => m.nombre === o)?.saldo ?? 0;
  const ahora = new Date().toISOString();
  const sinOrigen = est.mediosPago.filter((m) => m.nombre !== o);
  const mediosPago = sinOrigen.some((m) => m.nombre === d)
    ? sinOrigen.map((m) => (m.nombre === d ? { ...m, saldo: m.saldo + saldoO, usadoEn: ahora } : m))
    : [{ id: nuevoId(), nombre: d, saldo: saldoO, usadoEn: ahora }, ...sinOrigen];
  const cambiar = (medio: string | null) => (medio === o ? d : medio);
  parchearEstado({
    mediosPago,
    gastos: est.gastos.map((g) => ({
      ...g,
      metodoPago: cambiar(g.metodoPago),
      pagos: g.pagos ? g.pagos.map((p) => ({ ...p, medio: p.medio === o ? d : p.medio })) : g.pagos,
    })),
    ingresos: est.ingresos.map((i) => ({ ...i, medio: cambiar(i.medio) })),
    cargas: est.cargas.map((c) => ({ ...c, medio: c.medio === o ? d : c.medio })),
    gastosFijos: est.gastosFijos.map((f) => ({ ...f, metodoPago: cambiar(f.metodoPago) })),
  });
  // Si la base no pudo unirlos, todo vuelve a como estaba: mostrar unidos dos
  // medios que en la base siguen separados sería mentir.
  push(() => api.unirMedios(o, d), 'Medios unidos con éxito.', () => parchearEstado({
    mediosPago: est.mediosPago, gastos: est.gastos, ingresos: est.ingresos, cargas: est.cargas, gastosFijos: est.gastosFijos,
  }));
}

// ── Gastos fijos ─────────────────────────────────────────────────────────
export function crearGastoFijo(g: Omit<GastoFijo, 'id'>, avisar = true): GastoFijo {
  const fijo: GastoFijo = { ...g, id: nuevoId() };
  const est = leerEstado();
  parchearEstado({ gastosFijos: [...est.gastosFijos, fijo].sort((a, b) => a.proximoPago.localeCompare(b.proximoPago)) });
  push(() => api.crearGastoFijo(fijo), avisar ? 'Gasto fijo guardado con éxito.' : undefined, () => parchearEstado({ gastosFijos: leerEstado().gastosFijos.filter((x) => x.id !== fijo.id) }));
  return fijo;
}

/**
 * "Ya lo pagué": se registra como un gasto más (con la cotización de hoy, si es
 * en dólares) y el gasto fijo pasa a su próximo vencimiento.
 */
export async function pagarGastoFijo(id: string): Promise<string | null> {
  const est = leerEstado();
  const fijo = est.gastosFijos.find((x) => x.id === id);
  if (!fijo) return null;
  const r = await registrarGasto({
    monto: fijo.monto, moneda: fijo.moneda, descripcion: fijo.descripcion,
    seccionId: fijo.seccionId, tipo: fijo.tipo, metodoPago: fijo.metodoPago,
    confirmacion: 'Pago registrado con éxito.',
  });
  if (r.error !== null) return r.error;
  const proximo = siguienteVencimiento(fijo.proximoPago, fijo.frecuencia, fijo.diaAncla);
  parchearEstado({
    gastosFijos: leerEstado().gastosFijos
      .map((x) => (x.id === id ? { ...x, proximoPago: proximo } : x))
      .sort((a, b) => a.proximoPago.localeCompare(b.proximoPago)),
  });
  push(() => api.avanzarGastoFijo(id, proximo), undefined, () => parchearEstado({
    gastosFijos: leerEstado().gastosFijos.map((x) => (x.id === id ? { ...x, proximoPago: fijo.proximoPago } : x)),
  }));
  return null;
}

export function borrarGastoFijo(id: string) {
  const est = leerEstado();
  const fijo = est.gastosFijos.find((x) => x.id === id);
  parchearEstado({ gastosFijos: est.gastosFijos.filter((x) => x.id !== id) });
  push(() => api.borrarGastoFijo(id), 'Gasto fijo borrado con éxito.', () => {
    if (fijo && !leerEstado().gastosFijos.some((x) => x.id === id)) parchearEstado({ gastosFijos: [...leerEstado().gastosFijos, fijo] });
  });
}

/**
 * Registrar plata que entró: queda como ingreso (para ver cuánto entra contra
 * cuánto sale) Y suma al dinero disponible de ese medio. Es la diferencia con
 * `sumarDisponible`, que es para cargar plata que ya se tenía: esa no es un
 * ingreso, y si contara como tal el primer mes parecería que se ganó todo lo
 * ahorrado.
 */
export async function registrarIngreso(i: {
  monto: number; moneda: MonedaConvertible; fuente: FuenteIngreso | null; fuenteOtra?: string; descripcion?: string; medio: string; ts?: number;
}): Promise<{ ingreso: Ingreso | null; error: string | null }> {
  const conv = await aPesos(i.monto, i.moneda);
  if (conv.error !== null) return { ingreso: null, error: conv.error };
  const montoArs = conv.montoArs ?? 0;
  const medio = i.medio.trim() || 'Efectivo';
  const fuenteOtra = i.fuente === 'otro' ? i.fuenteOtra?.trim().slice(0, 40) || undefined : undefined;
  const ingreso: Ingreso = {
    id: nuevoId(), monto: i.monto, moneda: i.moneda, montoArs, fuente: i.fuente, ...(fuenteOtra ? { fuenteOtra } : {}),
    descripcion: i.descripcion?.trim() ?? '', medio, ts: i.ts ?? Date.now(), origen: 'web',
  };
  const est = leerEstado();
  const ahora = new Date().toISOString();
  const existe = est.mediosPago.find((m) => m.nombre === medio);
  parchearEstado({
    ingresos: [ingreso, ...est.ingresos],
    mediosPago: existe
      ? est.mediosPago.map((m) => (m.nombre === medio ? { ...m, saldo: m.saldo + montoArs, usadoEn: ahora } : m))
      : [{ id: nuevoId(), nombre: medio, saldo: montoArs, usadoEn: ahora }, ...est.mediosPago],
  });
  push(() => api.registrarIngreso({
    id: ingreso.id, monto: i.monto, moneda: i.moneda, montoArs, cotizacionId: conv.cotizacionId,
    fuente: i.fuente, fuenteOtra, descripcion: ingreso.descripcion, medio, ts: ingreso.ts,
  }), 'Ingreso registrado con éxito.', () => parchearEstado({ ingresos: est.ingresos, mediosPago: est.mediosPago }));
  return { ingreso, error: null };
}

/**
 * Edita un ingreso. Igual que `editarGasto`: se devuelve el efecto en el medio
 * viejo y se aplica el nuevo, y sólo se vuelve a pedir la cotización si de
 * verdad cambió el monto o la moneda.
 */
export async function editarIngreso(id: string, c: {
  monto?: number; moneda?: MonedaConvertible; fuente?: FuenteIngreso | null; fuenteOtra?: string;
  descripcion?: string; medio?: string; ts?: number;
}): Promise<{ error: string | null }> {
  const est = leerEstado();
  const actual = est.ingresos.find((x) => x.id === id);
  if (!actual) return { error: 'No encontramos ese ingreso.' };

  const moneda = c.moneda ?? actual.moneda;
  const monto = c.monto ?? actual.monto;
  const cambioMonto = c.monto !== undefined || c.moneda !== undefined;
  let montoArs = actual.montoArs;
  let cotizacionId: string | null = null;
  if (cambioMonto) {
    const conv = await aPesos(monto, moneda);
    if (conv.error !== null) return { error: conv.error };
    montoArs = conv.montoArs ?? 0;
    cotizacionId = conv.cotizacionId;
  }

  const medioNuevo = c.medio !== undefined ? (c.medio.trim() || 'Efectivo') : undefined;
  const medio = medioNuevo ?? actual.medio;
  const fuente = c.fuente !== undefined ? c.fuente : actual.fuente;
  const fuenteOtra = fuente === 'otro'
    ? (c.fuenteOtra !== undefined ? c.fuenteOtra.trim().slice(0, 40) || undefined : actual.fuenteOtra)
    : undefined;
  const ingreso: Ingreso = {
    ...actual, monto, moneda, montoArs, fuente, fuenteOtra,
    descripcion: c.descripcion !== undefined ? c.descripcion.trim() : actual.descripcion,
    medio, ts: c.ts ?? actual.ts,
  };

  // Devolver lo viejo, aplicar lo nuevo — un ajuste por medio.
  const cambioSaldo = cambioMonto || c.medio !== undefined;
  const ajustesSaldo = cambioSaldo
    ? [
      ...(actual.medio ? [{ medio: actual.medio, delta: -actual.montoArs }] : []),
      ...(medio ? [{ medio, delta: montoArs }] : []),
    ]
    : undefined;
  let mediosPago = est.mediosPago;
  const ahora = new Date().toISOString();
  for (const { medio: m, delta } of ajustesSaldo ?? []) {
    mediosPago = mediosPago.some((x) => x.nombre === m)
      ? mediosPago.map((x) => (x.nombre === m ? { ...x, saldo: x.saldo + delta } : x))
      : [{ id: nuevoId(), nombre: m, saldo: delta, usadoEn: ahora }, ...mediosPago];
  }

  parchearEstado({
    ingresos: est.ingresos.map((x) => (x.id === id ? ingreso : x)).sort((a, b) => b.ts - a.ts),
    mediosPago,
  });
  push(() => api.editarIngreso(id, {
    monto: cambioMonto ? monto : undefined,
    moneda: cambioMonto ? moneda : undefined,
    montoArs: cambioMonto ? montoArs : undefined,
    cotizacionId: cambioMonto ? cotizacionId : undefined,
    fuente: c.fuente,
    // Sólo se toca la columna nueva si hay algo que guardar o algo viejo que
    // borrar.
    fuenteOtra: (fuenteOtra || actual.fuenteOtra) ? (fuenteOtra ?? null) : undefined,
    descripcion: c.descripcion !== undefined ? ingreso.descripcion : undefined,
    medio: medioNuevo,
    ts: c.ts,
    ajustesSaldo,
  }), 'Ingreso editado con éxito.', () => parchearEstado({ ingresos: est.ingresos, mediosPago: est.mediosPago }));

  return { error: null };
}

export function borrarIngreso(id: string) {
  const est = leerEstado();
  const ingreso = est.ingresos.find((x) => x.id === id);
  const mediosPago = ingreso?.medio
    ? est.mediosPago.map((m) => (m.nombre === ingreso.medio ? { ...m, saldo: m.saldo - ingreso.montoArs } : m))
    : est.mediosPago;
  parchearEstado({ ingresos: est.ingresos.filter((x) => x.id !== id), mediosPago });
  push(() => api.borrarIngreso(id), 'Ingreso borrado con éxito.', () => {
    const actual = leerEstado();
    if (!ingreso || actual.ingresos.some((x) => x.id === id)) return;
    parchearEstado({ ingresos: [...actual.ingresos, ingreso].sort((a, b) => b.ts - a.ts), mediosPago: est.mediosPago });
  });
}

// ── Conversión a pesos ───────────────────────────────────────────────────
/**
 * Pasa un monto a pesos, congelando la cotización del día.
 *
 * En pesos es la identidad. En dólares hace falta la cotización, y si no se
 * puede traer devuelve error en vez de inventar un número: guardar un gasto
 * en dólares con una cotización adivinada mete un monto falso en todos los
 * totales, y encima queda indistinguible de uno real.
 */
async function aPesos(monto: number, moneda: Moneda): Promise<{ montoArs: number | null; cotizacionId: string | null; error: string | null }> {
  if (moneda === 'ARS') return { montoArs: monto, cotizacionId: null, error: null };
  // Euros, reales, pesos chilenos: FINA no tiene esas cotizaciones. El monto se
  // guarda en su moneda y el equivalente en pesos queda en null, que significa
  // "no se puede saber" — distinto de cero. El progreso de un objetivo se
  // calcula en su propia moneda, así que la pantalla sigue funcionando.
  if (!esConvertible(moneda)) return { montoArs: null, cotizacionId: null, error: null };
  const cot = await cotizacionDolar();
  if (!cot) {
    return { montoArs: 0, cotizacionId: null, error: 'No pudimos traer la cotización del dólar. Probá de nuevo en un momento.' };
  }
  return { montoArs: Math.round(monto * cot.valor), cotizacionId: cot.id, error: null };
}

// ── Gastos ───────────────────────────────────────────────────────────────
export async function registrarGasto(g: {
  monto: number; moneda: MonedaConvertible; descripcion: string;
  seccionId: string | null; tipo: TipoGasto; metodoPago: string | null;
  /** Lo que se escribió cuando el tipo es "otro". */
  tipoOtro?: string;
  /** Pagado con más de un medio: cada uno con su parte, suma = montoArs. */
  pagos?: PagoMixto[];
  grupoId?: string | null; ts?: number;
  /** Otro cartel de confirmación (por ejemplo, al pagar un gasto fijo). */
  confirmacion?: string;
}): Promise<{ gasto: Gasto | null; error: string | null }> {
  const conv = await aPesos(g.monto, g.moneda);
  if (conv.error !== null) return { gasto: null, error: conv.error };
  const montoArs = conv.montoArs ?? 0; // ARS/USD siempre convierten
  const dividido = !!g.pagos?.length;
  const tipoOtro = g.tipo === 'otro' ? g.tipoOtro?.trim().slice(0, 40) || undefined : undefined;

  const gasto: Gasto = {
    id: nuevoId(),
    monto: g.monto,
    moneda: g.moneda,
    montoArs,
    descripcion: g.descripcion,
    seccionId: g.seccionId,
    tipo: g.tipo,
    ...(tipoOtro ? { tipoOtro } : {}),
    metodoPago: dividido ? null : g.metodoPago,
    pagos: dividido ? g.pagos : undefined,
    grupoId: g.grupoId ?? null,
    ts: g.ts ?? Date.now(),
    origen: 'web',
  };

  const est = leerEstado();
  // El gasto descuenta del medio (o los medios) con que se pagó. Es lo que
  // hace que "¿de dónde salió?" tenga respuesta.
  let mediosPago = est.mediosPago;
  const ahora = new Date().toISOString();
  if (dividido) {
    for (const p of g.pagos!) {
      mediosPago = mediosPago.map((m) => (m.nombre === p.medio ? { ...m, saldo: m.saldo - p.monto, usadoEn: ahora } : m));
    }
  } else if (g.metodoPago) {
    mediosPago = mediosPago.map((m) => (m.nombre === g.metodoPago ? { ...m, saldo: m.saldo - montoArs, usadoEn: ahora } : m));
  }

  parchearEstado({ gastos: [gasto, ...est.gastos], mediosPago });
  const { confirmacion, ...datos } = g;
  push(() => api.registrarGasto({
    ...datos, tipoOtro, id: gasto.id, montoArs, cotizacionId: conv.cotizacionId,
  }), confirmacion ?? 'Gasto registrado con éxito.');

  // Registrar es la actividad con la que se compite en el grupo: se puntúa
  // haber anotado el gasto, nunca el monto.
  const grupo = est.grupo;
  if (grupo) push(() => api.sumarActividad(grupo.id, 1));

  return { gasto, error: null };
}

// Igual que borrar + registrar de nuevo, pero en un solo movimiento: se
// devuelve el efecto en el medio de pago viejo y se aplica el nuevo, y sólo
// se recalcula la cotización si de verdad cambió el monto o la moneda (así
// no se le pide de nuevo el dólar por editar solo la descripción).
export async function editarGasto(id: string, cambios: {
  monto?: number; moneda?: MonedaConvertible; descripcion?: string;
  seccionId?: string | null; tipo?: TipoGasto; metodoPago?: string | null;
  /** Lo escrito cuando el tipo es "otro". `null`/vacío = sin texto. */
  tipoOtro?: string | null;
  /** Pagado con más de un medio — reemplaza la lista entera, no se mergea. */
  pagos?: PagoMixto[] | null; ts?: number;
}): Promise<{ error: string | null }> {
  const est = leerEstado();
  const actual = est.gastos.find((g) => g.id === id);
  if (!actual) return { error: 'No encontramos ese gasto.' };

  const nuevaMoneda = cambios.moneda ?? actual.moneda;
  const nuevoMontoOriginal = cambios.monto ?? actual.monto;
  const cambioMontoOMoneda = cambios.monto !== undefined || cambios.moneda !== undefined;

  let montoArs = actual.montoArs;
  let cotizacionId: string | null = null;
  if (cambioMontoOMoneda) {
    const conv = await aPesos(nuevoMontoOriginal, nuevaMoneda);
    if (conv.error !== null) return { error: conv.error };
    montoArs = conv.montoArs ?? 0;
    cotizacionId = conv.cotizacionId;
  }

  // El pago se toca como UN bloque — nunca se "mergea" un medio simple con
  // uno dividido, son dos formas excluyentes de contar lo mismo. El form de
  // Gastos siempre manda los dos campos juntos y consistentes con el monto
  // (si está dividido, la suma de `pagos` YA es el monto nuevo).
  const pagoTocado = cambios.metodoPago !== undefined || cambios.pagos !== undefined;
  const pagosViejos: PagoMixto[] = actual.pagos?.length
    ? actual.pagos
    : actual.metodoPago ? [{ medio: actual.metodoPago, monto: actual.montoArs }] : [];
  const pagosNuevos: PagoMixto[] = pagoTocado
    ? (cambios.pagos?.length ? cambios.pagos : cambios.metodoPago ? [{ medio: cambios.metodoPago, monto: montoArs }] : [])
    // No se tocó el pago: sigue siendo el mismo medio (o los mismos), sólo se
    // actualiza el monto si cambió y era un medio único.
    : pagosViejos.length === 1 ? [{ ...pagosViejos[0], monto: montoArs }] : pagosViejos;

  // Devolver lo viejo, descontar lo nuevo — un ajuste por medio.
  let mediosPago = est.mediosPago;
  for (const p of pagosViejos) {
    mediosPago = mediosPago.map((m) => (m.nombre === p.medio ? { ...m, saldo: m.saldo + p.monto } : m));
  }
  for (const p of pagosNuevos) {
    mediosPago = mediosPago.map((m) => (m.nombre === p.medio ? { ...m, saldo: m.saldo - p.monto } : m));
  }

  const tipoFinal = cambios.tipo ?? actual.tipo;
  const tipoOtroFinal = tipoFinal === 'otro'
    ? (cambios.tipoOtro !== undefined ? cambios.tipoOtro?.trim().slice(0, 40) || undefined : actual.tipoOtro)
    : undefined;
  const metodoPagoFinal = pagosNuevos.length === 1 ? pagosNuevos[0].medio : null;
  const pagosFinal = pagosNuevos.length > 1 ? pagosNuevos : undefined;

  const gasto: Gasto = {
    ...actual,
    monto: nuevoMontoOriginal,
    moneda: nuevaMoneda,
    montoArs,
    descripcion: cambios.descripcion !== undefined ? cambios.descripcion : actual.descripcion,
    seccionId: cambios.seccionId !== undefined ? cambios.seccionId : actual.seccionId,
    tipo: tipoFinal,
    tipoOtro: tipoOtroFinal,
    metodoPago: metodoPagoFinal,
    pagos: pagosFinal,
    ts: cambios.ts ?? actual.ts,
  };

  const gastosDespues = est.gastos.map((g) => (g.id === id ? gasto : g)).sort((a, b) => b.ts - a.ts);
  parchearEstado({
    gastos: gastosDespues,
    mediosPago,
  });
  // Si el cambio movió el gasto a otra sección (o se lo sacó), la sección de
  // origen puede haber quedado vacía.
  if (cambios.seccionId !== undefined && cambios.seccionId !== actual.seccionId) {
    borrarSeccionSiQuedoVacia(actual.seccionId, est.gastos, gastosDespues);
  }

  // Un `mover_saldo` atómico por medio afectado — ver el comentario en
  // `index.ts`: esto es lo que faltaba para que editar (no sólo crear o
  // borrar) de verdad mueva el saldo en la base, no sólo en la pantalla.
  const ajustesSaldo = (pagoTocado || cambioMontoOMoneda)
    ? [
      ...pagosViejos.map((p) => ({ medio: p.medio, delta: p.monto })),
      ...pagosNuevos.map((p) => ({ medio: p.medio, delta: -p.monto })),
    ]
    : undefined;

  push(() => api.editarGasto(id, {
    monto: cambioMontoOMoneda ? nuevoMontoOriginal : undefined,
    moneda: cambios.moneda,
    montoArs: cambioMontoOMoneda ? montoArs : undefined,
    cotizacionId: cambioMontoOMoneda ? cotizacionId : undefined,
    descripcion: cambios.descripcion,
    seccionId: cambios.seccionId,
    tipo: cambios.tipo,
    // Sólo se toca la columna nueva si hay algo que guardar o algo viejo que
    // borrar: un edit común no depende de que la migración 0036 esté aplicada.
    tipoOtro: (tipoOtroFinal || actual.tipoOtro) ? (tipoOtroFinal ?? null) : undefined,
    metodoPago: pagoTocado ? metodoPagoFinal : undefined,
    pagos: pagoTocado && (pagosFinal || actual.pagos?.length) ? (pagosFinal ?? null) : undefined,
    ts: cambios.ts,
    ajustesSaldo,
  }), 'Gasto editado con éxito.');

  return { error: null };
}

export function borrarGasto(id: string) {
  const est = leerEstado();
  const gasto = est.gastos.find((g) => g.id === id);
  // La plata vuelve al medio (o a cada medio, si se dividió) con el que se
  // pagó: si sólo desapareciera el gasto, el disponible quedaría descontado
  // por algo que ya no existe.
  let mediosPago = est.mediosPago;
  if (gasto?.pagos?.length) {
    for (const p of gasto.pagos) {
      mediosPago = mediosPago.map((m) => (m.nombre === p.medio ? { ...m, saldo: m.saldo + p.monto } : m));
    }
  } else if (gasto?.metodoPago) {
    mediosPago = mediosPago.map((m) => (m.nombre === gasto.metodoPago ? { ...m, saldo: m.saldo + gasto.montoArs } : m));
  }
  const gastosDespues = est.gastos.filter((g) => g.id !== id);
  parchearEstado({ gastos: gastosDespues, mediosPago });
  if (gasto) borrarSeccionSiQuedoVacia(gasto.seccionId, est.gastos, gastosDespues);
  // Si la base no lo borró, vuelve a aparecer con su saldo: mostrar borrado un
  // gasto que sigue existiendo es justo lo que no puede pasar.
  push(() => api.borrarGasto(id), 'Gasto borrado con éxito.', () => {
    const actual = leerEstado();
    if (!gasto || actual.gastos.some((g) => g.id === id)) return;
    parchearEstado({ gastos: [...actual.gastos, gasto].sort((a, b) => b.ts - a.ts), mediosPago: est.mediosPago });
  });
}

// ── Objetivos ────────────────────────────────────────────────────────────
export function crearObjetivo(o: {
  nombre: string; descripcion?: string; tipo?: 'individual' | 'grupal';
  moneda?: Moneda; horizonte?: string | null; montoTotal: number | null;
  modoMonto?: Objetivo['modoMonto']; montoMin?: number | null;
}): Objetivo {
  const objetivo: Objetivo = {
    id: nuevoId(),
    nombre: o.nombre.trim(),
    descripcion: o.descripcion?.trim() ?? '',
    tipo: o.tipo ?? 'individual',
    moneda: o.moneda ?? 'ARS',
    horizonte: o.horizonte ?? null,
    modoMonto: o.modoMonto ?? null,
    montoTotal: o.montoTotal,
    montoMin: o.montoMin ?? null,
    estado: 'active',
    contribuciones: [],
  };
  parchearEstado({ objetivos: [...leerEstado().objetivos, objetivo] });
  push(() => api.crearObjetivo({ ...o, id: objetivo.id }), 'Objetivo creado con éxito.');
  return objetivo;
}

export function editarObjetivo(id: string, parche: Partial<Objetivo>) {
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === id ? { ...x, ...parche } : x)),
  });
  push(() => api.editarObjetivo(id, parche), 'Cambios guardados con éxito.');
}

export function borrarObjetivo(id: string) {
  parchearEstado({ objetivos: leerEstado().objetivos.filter((x) => x.id !== id) });
  push(() => api.borrarObjetivo(id), 'Objetivo borrado con éxito.');
}

export async function sumarContribucion(objetivoId: string, c: {
  monto: number; moneda: Moneda; kind: 'paid' | 'saved';
  label?: string | null; ts?: number;
}): Promise<{ contribucion: Contribucion | null; error: string | null }> {
  const conv = await aPesos(c.monto, c.moneda);
  if (conv.error !== null) return { contribucion: null, error: conv.error };

  const uid = (await idUsuaria()) ?? '';
  const contrib: Contribucion = {
    id: nuevoId(),
    monto: c.monto,
    moneda: c.moneda,
    montoArs: conv.montoArs,
    kind: c.kind,
    label: c.label ?? null,
    ts: c.ts ?? Date.now(),
    deUserId: uid,
  };
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === objetivoId
      ? { ...x, contribuciones: [contrib, ...x.contribuciones] }
      : x)),
  });
  push(() => api.sumarContribucion(objetivoId, {
    ...c, id: contrib.id, montoArs: conv.montoArs, cotizacionId: conv.cotizacionId,
  }), 'Registro sumado con éxito.');
  return { contribucion: contrib, error: null };
}

export function borrarContribucion(objetivoId: string, id: string) {
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === objetivoId
      ? { ...x, contribuciones: x.contribuciones.filter((c) => c.id !== id) }
      : x)),
  });
  push(() => api.borrarContribucion(id), 'Registro borrado con éxito.');
}

// ── Inversiones ──────────────────────────────────────────────────────────
export function guardarPerfilInversor(p: PerfilInversor) {
  parchearEstado({ perfilInversor: p });
  push(() => api.guardarPerfilInversor(p));
}

export async function sumarAporte(a: {
  instrumento: string; monto: number; moneda: MonedaConvertible; ts?: number;
}): Promise<{ aporte: AporteInversion | null; error: string | null }> {
  const conv = await aPesos(a.monto, a.moneda);
  if (conv.error !== null) return { aporte: null, error: conv.error };

  const aporte: AporteInversion = {
    id: nuevoId(),
    instrumento: a.instrumento,
    monto: a.monto,
    moneda: a.moneda,
    montoArs: conv.montoArs ?? 0,
    cotizacion: a.moneda === 'USD' && a.monto > 0 ? (conv.montoArs ?? 0) / a.monto : null,
    ts: a.ts ?? Date.now(),
  };
  parchearEstado({ aportes: [aporte, ...leerEstado().aportes] });
  push(() => api.sumarAporte({
    ...a, id: aporte.id, montoArs: conv.montoArs ?? 0, cotizacionId: conv.cotizacionId,
  }), 'Aporte registrado con éxito.');
  return { aporte, error: null };
}

export function editarAporte(id: string, parche: Partial<AporteInversion>) {
  parchearEstado({
    aportes: leerEstado().aportes.map((x) => (x.id === id ? { ...x, ...parche } : x)),
  });
  push(() => api.editarAporte(id, {
    instrumento: parche.instrumento,
    monto: parche.monto,
    moneda: parche.moneda,
    montoArs: parche.montoArs ?? undefined,
  }), 'Cambios guardados con éxito.');
}

export function borrarAporte(id: string) {
  parchearEstado({ aportes: leerEstado().aportes.filter((x) => x.id !== id) });
  push(() => api.borrarAporte(id), 'Aporte borrado con éxito.');
}

// ── Inversiones registradas (migración 0039) ─────────────────────────────
/** Dice en criollo que falta la migración, en vez de mostrar el error crudo de la base. */
function mensajeDePosicion(error: string): string {
  if (/investment_positions|schema cache|does not exist|relation/i.test(error)) {
    return 'Todavía no está lista la base para guardar esto (falta correr la migración 0039 en Supabase).';
  }
  return error;
}

/**
 * Guarda una inversión. A diferencia de los aportes, NO se pinta antes de que la
 * base confirme: si falla, la persona tiene que enterarse ahora y no creer que
 * quedó guardado un vencimiento que nunca existió.
 */
export async function registrarPosicion(
  datos: Omit<PosicionInversion, 'id' | 'ts' | 'estado'>,
): Promise<{ posicion: PosicionInversion | null; error: string | null }> {
  const r = await api.crearPosicion({ ...datos, id: nuevoId(), estado: 'activa' });
  if (r.error !== null) return { posicion: null, error: mensajeDePosicion(r.error) };
  parchearEstado({ posiciones: [r.data, ...leerEstado().posiciones] });
  avisarConfirmacion('Inversión registrada con éxito.');
  return { posicion: r.data, error: null };
}

export function cerrarPosicion(id: string) {
  parchearEstado({
    posiciones: leerEstado().posiciones.map((p) => (p.id === id ? { ...p, estado: 'cerrada' as const } : p)),
  });
  push(() => api.editarPosicion(id, { estado: 'cerrada' }), 'Inversión marcada como cerrada.');
}

export function borrarPosicion(id: string) {
  parchearEstado({ posiciones: leerEstado().posiciones.filter((p) => p.id !== id) });
  push(() => api.borrarPosicion(id), 'Inversión borrada con éxito.');
}

// ── Verificación del teléfono ────────────────────────────────────────────
export async function pedirCodigoTelefono(telefono: string | null): Promise<{ codigo: string | null; error: string | null }> {
  const r = await api.pedirCodigoTelefono(telefono);
  if (r.error !== null) return { codigo: null, error: r.error };
  return { codigo: r.data, error: null };
}

/**
 * Pregunta si el bot ya verificó el teléfono.
 *
 * La app consulta cada unos segundos mientras la pantalla está abierta: el que
 * confirma es el bot, del otro lado, así que no hay forma de que nos avise. Es
 * una espera corta y acotada a esa pantalla.
 */
export async function refrescarTelefono(): Promise<boolean> {
  const r = await api.leerTelefonoVerificado();
  if (r.error !== null || r.data.verificadoEn === null) return false;
  parchearEstado({
    perfil: {
      ...leerEstado().perfil,
      telefono: r.data.telefono,
      telefonoVerificadoEn: r.data.verificadoEn,
    },
  });
  return true;
}

// ── Foto de perfil ───────────────────────────────────────────────────────
export async function subirFoto(archivo: File): Promise<{ url: string | null; error: string | null }> {
  const r = await api.subirFoto(archivo);
  if (r.error !== null) return { url: null, error: r.error };
  parchearEstado({ perfil: { ...leerEstado().perfil, fotoUrl: r.data } });
  avisarConfirmacion('Foto actualizada con éxito.');
  return { url: r.data, error: null };
}

export async function borrarFoto(): Promise<string | null> {
  const r = await api.borrarFoto();
  if (r.error !== null) return r.error;
  parchearEstado({ perfil: { ...leerEstado().perfil, fotoUrl: null } });
  avisarConfirmacion('Foto eliminada con éxito.');
  return null;
}

// ── Grupos ───────────────────────────────────────────────────────────────
// Los grupos NO son optimistas. El código lo genera el servidor y unirse puede
// fallar porque el código no existe: pintar el grupo antes de saberlo sería
// mostrarle a la persona que entró a un grupo que no existe.
export async function crearGrupo(nombre: string): Promise<{ grupo: Grupo | null; error: string | null }> {
  const r = await api.crearGrupo(nombre);
  if (r.error !== null) return { grupo: null, error: r.error };
  // Se relee en vez de usar lo que devolvió el insert: los nombres de las
  // miembras salen de la vista `group_member_names`, no de la fila del grupo.
  const conMiembros = await api.leerMiGrupo();
  const grupo = conMiembros.data ?? r.data;
  parchearEstado({ grupo });
  avisarConfirmacion('Grupo creado con éxito.');
  return { grupo, error: null };
}

export async function unirseAGrupo(codigo: string): Promise<{ grupo: Grupo | null; error: string | null }> {
  const r = await api.unirseAGrupo(codigo);
  if (r.error !== null) return { grupo: null, error: r.error };
  if (r.data === null) return { grupo: null, error: 'Ese código no existe. Fijate que esté bien escrito.' };
  parchearEstado({ grupo: r.data });
  avisarConfirmacion('Te uniste al grupo con éxito.');
  return { grupo: r.data, error: null };
}

export async function salirDelGrupo(): Promise<string | null> {
  const grupo = leerEstado().grupo;
  if (!grupo) return null;
  const r = await api.salirDelGrupo(grupo.id);
  if (r.error !== null) return r.error;
  parchearEstado({ grupo: null });
  avisarConfirmacion('Saliste del grupo con éxito.');
  return null;
}

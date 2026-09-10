import { encolar, estaHidratado, leerEstado, parchearEstado } from './almacen';
import * as api from './index';
import type {
  AporteInversion, Contribucion, Gasto, Grupo, Moneda, Objetivo, Perfil,
  PerfilInversor, Periodo, Seccion, TipoGasto,
} from './tipos';

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
function push(fn: () => Promise<{ data: unknown; error: string | null }>) {
  if (!estaHidratado()) return;
  void encolar(fn);
}

// ── Perfil ───────────────────────────────────────────────────────────────
export function guardarPerfil(parche: Partial<Perfil>) {
  parchearEstado({ perfil: { ...leerEstado().perfil, ...parche } });
  push(() => api.guardarPerfil(parche));
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
  push(() => api.renombrarSeccion(id, nombre));
}

export function guardarTope(id: string, tope: { monto: number; periodo: Periodo } | null) {
  parchearEstado({
    secciones: leerEstado().secciones.map((s) => (s.id === id ? { ...s, tope } : s)),
  });
  push(() => api.guardarTope(id, tope));
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
  push(() => api.borrarSeccion(id));
}

// ── Medios de pago ───────────────────────────────────────────────────────
export function sumarDisponible(medio: string, monto: number) {
  const nombre = medio.trim() || 'Efectivo';
  const est = leerEstado();
  const existe = est.mediosPago.find((m) => m.nombre === nombre);
  const ahora = new Date().toISOString();
  parchearEstado({
    mediosPago: existe
      ? est.mediosPago.map((m) => (m.nombre === nombre ? { ...m, saldo: m.saldo + monto, usadoEn: ahora } : m))
      : [{ id: nuevoId(), nombre, saldo: monto, usadoEn: ahora }, ...est.mediosPago],
  });
  push(() => api.sumarDisponible(nombre, monto));
}

// ── Gastos ───────────────────────────────────────────────────────────────
export function registrarGasto(g: {
  monto: number; moneda: Moneda; montoArs: number; descripcion: string;
  seccionId: string | null; tipo: TipoGasto; metodoPago: string | null;
  grupoId?: string | null; ts?: number;
}): Gasto {
  const gasto: Gasto = {
    id: nuevoId(),
    monto: g.monto,
    moneda: g.moneda,
    descripcion: g.descripcion,
    seccionId: g.seccionId,
    tipo: g.tipo,
    metodoPago: g.metodoPago,
    grupoId: g.grupoId ?? null,
    ts: g.ts ?? Date.now(),
    origen: 'web',
  };

  const est = leerEstado();
  // El gasto descuenta del medio con el que se pagó. Es lo que hace que
  // "¿de dónde salió?" tenga respuesta.
  const mediosPago = g.metodoPago
    ? est.mediosPago.map((m) => (m.nombre === g.metodoPago
      ? { ...m, saldo: m.saldo - g.montoArs, usadoEn: new Date().toISOString() }
      : m))
    : est.mediosPago;

  parchearEstado({ gastos: [gasto, ...est.gastos], mediosPago });
  push(() => api.registrarGasto({ ...g, id: gasto.id }));

  // Registrar es la actividad con la que se compite en el grupo: se puntúa
  // haber anotado el gasto, nunca el monto.
  const grupo = est.grupo;
  if (grupo) push(() => api.sumarActividad(grupo.id, 1));

  return gasto;
}

export function borrarGasto(id: string) {
  parchearEstado({ gastos: leerEstado().gastos.filter((g) => g.id !== id) });
  push(() => api.borrarGasto(id));
}

// ── Objetivos ────────────────────────────────────────────────────────────
export function crearObjetivo(o: {
  nombre: string; descripcion?: string; tipo?: 'individual' | 'grupal';
  moneda?: Moneda; horizonte?: string | null; montoTotal: number | null;
}): Objetivo {
  const objetivo: Objetivo = {
    id: nuevoId(),
    nombre: o.nombre.trim(),
    descripcion: o.descripcion?.trim() ?? '',
    tipo: o.tipo ?? 'individual',
    moneda: o.moneda ?? 'ARS',
    horizonte: o.horizonte ?? null,
    montoTotal: o.montoTotal,
    estado: 'active',
    contribuciones: [],
  };
  parchearEstado({ objetivos: [...leerEstado().objetivos, objetivo] });
  push(() => api.crearObjetivo({ ...o, id: objetivo.id }));
  return objetivo;
}

export function editarObjetivo(id: string, parche: Partial<Objetivo>) {
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === id ? { ...x, ...parche } : x)),
  });
  push(() => api.editarObjetivo(id, parche));
}

export function borrarObjetivo(id: string) {
  parchearEstado({ objetivos: leerEstado().objetivos.filter((x) => x.id !== id) });
  push(() => api.borrarObjetivo(id));
}

export function sumarContribucion(objetivoId: string, c: {
  monto: number; moneda: Moneda; montoArs: number; kind: 'paid' | 'saved';
  label?: string | null; ts?: number;
}): Contribucion {
  const contrib: Contribucion = {
    id: nuevoId(),
    monto: c.monto,
    moneda: c.moneda,
    montoArs: c.montoArs,
    kind: c.kind,
    label: c.label ?? null,
    ts: c.ts ?? Date.now(),
  };
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === objetivoId
      ? { ...x, contribuciones: [contrib, ...x.contribuciones] }
      : x)),
  });
  push(() => api.sumarContribucion(objetivoId, { ...c, id: contrib.id }));
  return contrib;
}

export function borrarContribucion(objetivoId: string, id: string) {
  parchearEstado({
    objetivos: leerEstado().objetivos.map((x) => (x.id === objetivoId
      ? { ...x, contribuciones: x.contribuciones.filter((c) => c.id !== id) }
      : x)),
  });
  push(() => api.borrarContribucion(id));
}

// ── Inversiones ──────────────────────────────────────────────────────────
export function guardarPerfilInversor(p: PerfilInversor) {
  parchearEstado({ perfilInversor: p });
  push(() => api.guardarPerfilInversor(p));
}

export function sumarAporte(a: {
  instrumento: string; monto: number; moneda: Moneda; montoArs: number; ts?: number;
}): AporteInversion {
  const aporte: AporteInversion = {
    id: nuevoId(),
    instrumento: a.instrumento,
    monto: a.monto,
    moneda: a.moneda,
    montoArs: a.montoArs,
    cotizacion: null,
    ts: a.ts ?? Date.now(),
  };
  parchearEstado({ aportes: [aporte, ...leerEstado().aportes] });
  push(() => api.sumarAporte({ ...a, id: aporte.id }));
  return aporte;
}

export function editarAporte(id: string, parche: Partial<AporteInversion>) {
  parchearEstado({
    aportes: leerEstado().aportes.map((x) => (x.id === id ? { ...x, ...parche } : x)),
  });
  push(() => api.editarAporte(id, {
    instrumento: parche.instrumento,
    monto: parche.monto,
    moneda: parche.moneda,
    montoArs: parche.montoArs,
  }));
}

export function borrarAporte(id: string) {
  parchearEstado({ aportes: leerEstado().aportes.filter((x) => x.id !== id) });
  push(() => api.borrarAporte(id));
}

// ── Grupos ───────────────────────────────────────────────────────────────
// Los grupos NO son optimistas. El código lo genera el servidor y unirse puede
// fallar porque el código no existe: pintar el grupo antes de saberlo sería
// mostrarle a la persona que entró a un grupo que no existe.
export async function crearGrupo(nombre: string): Promise<{ grupo: Grupo | null; error: string | null }> {
  const r = await encolar(() => api.crearGrupo(nombre));
  if (!r) return { grupo: null, error: 'No pudimos crear el grupo.' };
  parchearEstado({ grupo: r });
  return { grupo: r, error: null };
}

export async function unirseAGrupo(codigo: string): Promise<{ grupo: Grupo | null; error: string | null }> {
  const r = await api.unirseAGrupo(codigo);
  if (r.error !== null) return { grupo: null, error: r.error };
  if (r.data === null) return { grupo: null, error: 'Ese código no existe. Fijate que esté bien escrito.' };
  parchearEstado({ grupo: r.data });
  return { grupo: r.data, error: null };
}

export async function salirDelGrupo(): Promise<string | null> {
  const grupo = leerEstado().grupo;
  if (!grupo) return null;
  const r = await api.salirDelGrupo(grupo.id);
  if (r.error !== null) return r.error;
  parchearEstado({ grupo: null });
  return null;
}

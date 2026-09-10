import { cargarTodo } from './index';
import { ESTADO_VACIO, type EstadoV2 } from './tipos';

// ─────────────────────────────────────────────────────────────────────────
// El almacén: la copia en memoria de todo lo que la usuaria tiene en Supabase.
//
// POR QUÉ EXISTE. Las pantallas del v2 leen su estado de forma síncrona
// (`const [estado, setEstado] = useState(() => cargar())`). Una lectura contra
// la red no puede ser síncrona, así que en vez de convertir siete pantallas a
// async, se hidrata UNA vez al entrar y después todas leen de acá. La red
// queda del lado de la escritura, que sí puede ser asíncrona sin que la
// interfaz se trabe.
//
// Supabase es la verdad. Esta copia existe para poder pintar rápido y para que
// la app siga usable si la red se cae en medio de una sesión; nunca para
// reemplazar la base.
// ─────────────────────────────────────────────────────────────────────────

let estado: EstadoV2 = ESTADO_VACIO;
let hidratado = false;

/** Suscriptores: se les avisa cuando cambia el estado o el estado de guardado. */
const oyentes = new Set<() => void>();
function avisar() { oyentes.forEach((f) => f()); }

export function suscribir(f: () => void): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

export function leerEstado(): EstadoV2 { return estado; }
export function estaHidratado(): boolean { return hidratado; }

/** Reemplaza la copia local. La usan `hidratar` y las escrituras optimistas. */
export function fijarEstado(siguiente: EstadoV2) {
  estado = siguiente;
  avisar();
}

export function parchearEstado(parche: Partial<EstadoV2>) {
  estado = { ...estado, ...parche };
  avisar();
}

/** Trae todo de Supabase. Devuelve el error para que la UI pueda mostrarlo. */
export async function hidratar(): Promise<string | null> {
  const r = await cargarTodo();
  if (r.error !== null) return r.error;
  estado = r.data;
  hidratado = true;
  avisar();
  return null;
}

export function olvidar() {
  estado = ESTADO_VACIO;
  hidratado = false;
  avisar();
}

// ── Estado de guardado ───────────────────────────────────────────────────
// Se muestra en la interfaz. Un guardado que falla en silencio es peor que uno
// que falla: la persona sigue confiando en un número que la base no tiene.
export type EstadoGuardado =
  | { tipo: 'quieto' }
  | { tipo: 'guardando' }
  | { tipo: 'error'; mensaje: string; cuando: number };

let guardado: EstadoGuardado = { tipo: 'quieto' };
export function leerGuardado(): EstadoGuardado { return guardado; }

let pendientes = 0;

/**
 * Corre una escritura y refleja su resultado en el estado de guardado.
 *
 * Las escrituras van en SERIE (una cola), no en paralelo. Dos razones: el
 * orden importa (crear la sección antes que el gasto que la usa), y el
 * reconciliador puede emitir varias escrituras sobre la misma fila en el mismo
 * tick — en paralelo se pisarían.
 */
let cola: Promise<unknown> = Promise.resolve();

export function encolar<T>(fn: () => Promise<{ data: T | null; error: string | null }>): Promise<T | null> {
  pendientes += 1;
  if (guardado.tipo !== 'guardando') { guardado = { tipo: 'guardando' }; avisar(); }

  const corrida = cola.then(async () => {
    try {
      const r = await fn();
      if (r.error !== null) {
        guardado = { tipo: 'error', mensaje: r.error, cuando: Date.now() };
        return null;
      }
      return r.data;
    } catch (e) {
      guardado = { tipo: 'error', mensaje: e instanceof Error ? e.message : String(e), cuando: Date.now() };
      return null;
    } finally {
      pendientes -= 1;
      // Sólo se vuelve a "quieto" cuando no queda nada pendiente, y nunca se
      // borra un error: si algo falló, el cartel se queda hasta que la persona
      // reintente. Que desaparezca solo sería volver a mentirle.
      if (pendientes === 0 && guardado.tipo === 'guardando') guardado = { tipo: 'quieto' };
      avisar();
    }
  });

  cola = corrida.catch(() => undefined);
  return corrida as Promise<T | null>;
}

/** La UI llama a esto cuando la persona toca "reintentar" y salió bien. */
export function limpiarError() {
  if (guardado.tipo === 'error') { guardado = { tipo: 'quieto' }; avisar(); }
}

/** Espera a que la cola se vacíe. Sirve al cerrar el onboarding. */
export function esperarCola(): Promise<void> {
  return cola.then(() => undefined, () => undefined);
}

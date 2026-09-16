import { falla, idUsuaria, ok, supabase, type Resultado } from './cliente';
import { avisarConfirmacion } from './almacen';

// Notificaciones de la app (web push).
//
// Para recibirlas, el navegador tiene que (1) soportarlas, (2) tener el service
// worker registrado (public/sw.js), (3) que la persona dé permiso, y (4) quedar
// anotado en Supabase (`push_subscriptions`) para que el servidor sepa a dónde
// mandar.
//
// iPhone: sólo funcionan con FINA agregada a la pantalla de inicio (iOS 16.4 o
// más nuevo). Desde Safari común no existen, y hay que explicarlo en vez de
// mostrar un botón que no hace nada.

const CLAVE_PUBLICA = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();

export type SoporteNotificaciones =
  | 'si'
  | 'iphone-sin-instalar'  // iPhone/iPad desde el navegador: hay que agregarla a inicio
  | 'no-configurado'       // falta la clave pública en el servidor
  | 'no';                  // el navegador no las soporta

export type PreferenciasAvisos = {
  paso: boolean;
  racha: boolean;
  separar: boolean;
  resumen: boolean;
  /** Día del mes en que cobra (1 a 31), o null si no lo dijo. */
  diaCobro: number | null;
};

export const PREFERENCIAS_POR_DEFECTO: PreferenciasAvisos = { paso: true, racha: true, separar: true, resumen: true, diaCobro: null };

export function soporteNotificaciones(): SoporteNotificaciones {
  if (typeof window === 'undefined') return 'no';
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const tieneApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (esIOS && !instalada) return 'iphone-sin-instalar';
  if (!tieneApi) return 'no';
  if (!CLAVE_PUBLICA) return 'no-configurado';
  return 'si';
}

/** Registra el service worker. Se llama al arrancar la app. */
export function registrarServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('[push] service worker:', e));
  });
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** true si ESTE navegador está anotado para recibir avisos. */
export async function notificacionesActivas(): Promise<boolean> {
  if (soporteNotificaciones() !== 'si' || Notification.permission !== 'granted') return false;
  return !!(await suscripcionActual());
}

function aUint8(base64Url: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const b64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type ResultadoActivar = 'activadas' | 'permiso-denegado' | 'no-soportado' | 'error';

export async function activarNotificaciones(): Promise<{ resultado: ResultadoActivar; error?: string }> {
  if (soporteNotificaciones() !== 'si' || !CLAVE_PUBLICA) return { resultado: 'no-soportado' };
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return { resultado: 'permiso-denegado' };

    const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8(CLAVE_PUBLICA) }));

    const json = sub.toJSON();
    const uid = await idUsuaria();
    if (!uid || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { resultado: 'error', error: 'sin sesión o suscripción incompleta' };

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: uid,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) return { resultado: 'error', error: error.message };

    avisarConfirmacion('Listo: te van a llegar los avisos de FINA en este dispositivo.');
    return { resultado: 'activadas' };
  } catch (e) {
    console.error('[push] activar:', e);
    return { resultado: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function desactivarNotificaciones(): Promise<Resultado<null>> {
  try {
    const sub = await suscripcionActual();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    avisarConfirmacion('Listo: ya no te llegan avisos en este dispositivo.');
    return ok(null);
  } catch (e) {
    return falla<null>(e, 'desactivarNotificaciones');
  }
}

export async function leerPreferenciasAvisos(): Promise<PreferenciasAvisos> {
  // `*` y no columnas sueltas: si todavía no se corrió la 0031, las columnas
  // nuevas no existen y pedirlas por nombre haría fallar la lectura entera.
  const { data } = await supabase.from('notification_prefs').select('*').maybeSingle();
  const d = data as { paso?: boolean; racha?: boolean; separar?: boolean; resumen?: boolean; dia_cobro?: number | null } | null;
  // Sin fila = todos activados.
  return {
    paso: d?.paso ?? true,
    racha: d?.racha ?? true,
    separar: d?.separar ?? true,
    resumen: d?.resumen ?? true,
    diaCobro: d?.dia_cobro ?? null,
  };
}

export async function guardarPreferenciasAvisos(p: PreferenciasAvisos): Promise<Resultado<null>> {
  const uid = await idUsuaria();
  if (!uid) return falla<null>('sin sesión', 'guardarPreferenciasAvisos');
  const { error } = await supabase.from('notification_prefs').upsert({
    user_id: uid, paso: p.paso, racha: p.racha, separar: p.separar, resumen: p.resumen, dia_cobro: p.diaCobro,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return falla<null>(error.message, 'guardarPreferenciasAvisos');
  avisarConfirmacion('Guardamos qué avisos querés recibir.');
  return ok(null);
}

/** Manda un aviso de prueba a todos los dispositivos de la persona. */
export async function mandarAvisoDePrueba(): Promise<Resultado<number>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return falla<number>('sin sesión', 'mandarAvisoDePrueba');
    const res = await fetch('/api/notificacion-prueba', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const cuerpo = (await res.json().catch(() => null)) as { enviadas?: number; error?: string } | null;
    if (!res.ok) return falla<number>(cuerpo?.error ?? `respuesta ${res.status}`, 'mandarAvisoDePrueba');
    return ok(cuerpo?.enviadas ?? 0);
  } catch (e) {
    return falla<number>(e, 'mandarAvisoDePrueba');
  }
}

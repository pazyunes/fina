import webpush from 'web-push';

// Mandar un aviso a un navegador. Lo usan la tarea programada
// (api/notificaciones.ts) y el botón de prueba (api/notificacion-prueba.ts).
//
// Las claves VAPID identifican a FINA ante los servicios de notificaciones de
// cada navegador (Google, Apple, Mozilla). La pública también la usa la app
// (VITE_VAPID_PUBLIC_KEY) para anotarse; la privada vive sólo en el servidor.

export type Suscripcion = { id?: string; endpoint: string; p256dh: string; auth: string };
export type Aviso = { title: string; body: string; url: string; tag: string };

let configurado: boolean | null = null;

export function configurarPush(): boolean {
  if (configurado !== null) return configurado;
  const publica = process.env.VITE_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) { configurado = false; return false; }
  // El "subject" es un contacto para los servicios de notificaciones si algo
  // anda mal con los envíos. No se muestra a nadie.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hola@somosfina.com.ar', publica, privada);
  configurado = true;
  return true;
}

/**
 * Devuelve 'ok', 'vencida' (el navegador ya no acepta avisos: hay que borrar la
 * suscripción) o 'error' (algo transitorio: se deja para la próxima).
 */
export async function enviarAviso(s: Suscripcion, aviso: Aviso): Promise<'ok' | 'vencida' | 'error'> {
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(aviso),
      // Si el celular está apagado, el aviso espera hasta 6 horas. Un
      // recordatorio del día que llega a la mañana siguiente no sirve.
      { TTL: 6 * 60 * 60, urgency: 'normal' },
    );
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'vencida';
    console.error('[push] envío:', status, e instanceof Error ? e.message : e);
    return 'error';
  }
}

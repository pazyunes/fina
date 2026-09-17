import { supabase } from './cliente';
import { olvidar } from './almacen';
import { desactivarNotificaciones } from './notificaciones';
import { olvidarRecomendaciones } from './recomendaciones';

// ¿Ya hay una cuenta con este mail o este teléfono?
//
// Sirve para decirle a la persona lo que realmente pasa: "no tenés cuenta con
// este mail" al entrar, o "ya tenés una cuenta" al crearla, con el botón que la
// lleva al lugar correcto. Sin esto, Supabase sólo dice "mail o contraseña
// incorrectos" y no se sabe si falta la cuenta o la contraseña está mal.
//
// Usa las funciones email_in_use (0019) y phone_in_use (0011), que ya estaban en
// la base desde la app anterior.
//
// Devuelve null si no se pudo consultar: en ese caso no se decide nada y se
// sigue con el mensaje de siempre, en vez de trabar a la persona.

export async function emailTieneCuenta(email: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc('email_in_use', { p_email: email.trim().toLowerCase() });
    return error ? null : Boolean(data);
  } catch {
    return null;
  }
}

/** `telefono` en formato canónico: +54 y 10 dígitos, sin el 9. */
export async function telefonoTieneCuenta(telefono: string): Promise<boolean | null> {
  if (!telefono) return null;
  try {
    const { data, error } = await supabase.rpc('phone_in_use', { p_phone: telefono });
    return error ? null : Boolean(data);
  } catch {
    return null;
  }
}

/**
 * Cerrar sesión en este dispositivo.
 *
 * Además de cerrar la sesión de Supabase, deja el dispositivo limpio para la
 * próxima persona que entre en él:
 *  · se desanotan los avisos de este dispositivo (si no, le seguirían llegando
 *    a quien use el celular los avisos de la cuenta anterior);
 *  · se vacía la copia en memoria de los datos y de las recomendaciones.
 * Lo que queda guardado en el navegador lo borra la pantalla (ver
 * borrarDatosLocales en shared.tsx).
 */
export async function cerrarSesion(): Promise<void> {
  // Mientras hay sesión: borrar la suscripción de la base necesita saber de quién es.
  try { await desactivarNotificaciones(true); } catch { /* no bloquea el cierre */ }
  await supabase.auth.signOut();
  olvidar();
  olvidarRecomendaciones();
}


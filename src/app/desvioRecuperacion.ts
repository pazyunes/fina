// Se importa PRIMERO en main.tsx, antes que la app. Tiene que correr antes de
// que se creen el router y el cliente de Supabase.
//
// El link de "¿Olvidaste tu contraseña?" trae la sesión de recuperación en el
// `#` de la dirección (#access_token=…&type=recovery). Si /reset-password no está
// en la lista permitida de Supabase, el link llega a la página principal, y ahí
// la app veía una sesión y llevaba a Home: la persona nunca podía poner la
// contraseña nueva. Lo mismo con un link vencido (#error_code=otp_expired…).
//
// Acá se corrige la dirección a /reset-password CONSERVANDO el `#`, sin
// recargar. Así el router arranca directamente en esa pantalla, y Supabase lee
// la sesión del `#` como siempre.
//
// Antes se hacía después de montar la app, esperando a Supabase y navegando con
// el router: en producción el router todavía no había terminado de arrancar y
// la pantalla quedaba mostrando el inicio con la dirección de /reset-password.

if (typeof window !== 'undefined' && window.location.pathname !== '/reset-password') {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const leer = (k: string) => hash.get(k) ?? query.get(k);
  const vieneDelMail = leer('type') === 'recovery' || !!leer('error_code');
  if (vieneDelMail) {
    window.history.replaceState(window.history.state, '', `/reset-password${window.location.search}${window.location.hash}`);
  }
}

export {};

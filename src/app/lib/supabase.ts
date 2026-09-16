import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — reports will not be persisted.');
}

// ── ¿Se llegó desde un link del mail? ──────────────────────────────────────
// Se lee ANTES de crear el cliente. El link de "¿Olvidaste tu contraseña?"
// trae la sesión de recuperación en el `#` de la dirección
// (#access_token=…&type=recovery), y el cliente de Supabase la procesa y BORRA
// ese `#` apenas arranca. Después ya no hay forma de saber que la persona venía
// a cambiar la contraseña.
//
// Hace falta saberlo porque el link no siempre llega a /reset-password: si esa
// dirección no está en la lista permitida de Supabase (Authentication → URL
// Configuration), Supabase manda a la página principal. Ahí la app veía una
// sesión y llevaba a Home, y la persona nunca podía poner la contraseña nueva.
//
// Si el link venció o ya se usó, Supabase no trae sesión sino un error
// (#error_code=otp_expired…). También se guarda, para explicarlo en vez de
// dejar a la persona en el inicio sin entender qué pasó.
function leerLlegadaDesdeMail(): { recuperacion: boolean; errorDeLink: string | null } {
  if (typeof window === 'undefined') return { recuperacion: false, errorDeLink: null };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const leer = (k: string) => hash.get(k) ?? query.get(k);
  return {
    recuperacion: leer('type') === 'recovery',
    errorDeLink: leer('error_code') ?? (leer('error') ? leer('error_description') ?? leer('error') : null),
  };
}
export const LLEGADA_DESDE_MAIL = leerLlegadaDesdeMail();

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost',
  anonKey ?? 'anon',
  // PR3: persistimos la sesión para soportar login email/contraseña y el
  // historial por usuario (/perfil). autoRefreshToken mantiene viva la sesión.
  // detectSessionInUrl: procesa el token del link de recuperación de contraseña
  // (evento PASSWORD_RECOVERY) cuando la usuaria aterriza en /reset-password.
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

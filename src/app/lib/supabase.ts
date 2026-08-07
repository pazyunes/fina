import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — reports will not be persisted.');
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost',
  anonKey ?? 'anon',
  // PR3: persistimos la sesión para soportar login email/contraseña y el
  // historial por usuario (/perfil). autoRefreshToken mantiene viva la sesión.
  // detectSessionInUrl: procesa el token del link de recuperación de contraseña
  // (evento PASSWORD_RECOVERY) cuando la usuaria aterriza en /reset-password.
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

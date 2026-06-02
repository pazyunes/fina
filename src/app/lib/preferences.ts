import { supabase, isSupabaseConfigured } from './supabase';

// PR7 — Preferencias para recomendaciones personalizadas.
// Persisten en la tabla `user_preferences` (ver migration 0006).

export interface UserPreferences {
  // Ranking de 5 categorías (slugs internos) que NO querés recortar.
  // posición 0 = la que MENOS estás dispuesta a recortar; posición 4 = la que más.
  // Si la usuaria no completó el form todavía, el array está vacío.
  topUnwilling: string[];
  // Texto libre con los lugares que la usuaria frecuenta (cafés/restaurantes).
  frequentSpots: string[];
}

const EMPTY: UserPreferences = { topUnwilling: [], frequentSpots: [] };

// Devuelve las preferencias del usuario logueado, o EMPTY si todavía no las
// guardó. RLS garantiza que solo se devuelven las propias.
export async function fetchUserPreferences(): Promise<UserPreferences> {
  if (!isSupabaseConfigured) return EMPTY;
  const { data, error } = await supabase
    .from('user_preferences')
    .select('top_unwilling, frequent_spots')
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[fina] fetchUserPreferences failed:', error.message);
    return EMPTY;
  }
  if (!data) return EMPTY;
  return {
    topUnwilling: (data.top_unwilling as string[] | null) ?? [],
    frequentSpots: (data.frequent_spots as string[] | null) ?? [],
  };
}

// Upsert: la primera vez inserta; las siguientes actualiza. La PK es user_id
// (declarado en la migration), así que onConflict apunta ahí.
export async function saveUserPreferences(prefs: UserPreferences): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase no configurado' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: 'Sin sesión activa' };
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: session.user.id,
        top_unwilling: prefs.topUnwilling,
        frequent_spots: prefs.frequentSpots,
      },
      { onConflict: 'user_id' }
    );
  return { error: error?.message ?? null };
}

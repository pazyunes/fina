import { supabase, isSupabaseConfigured } from './supabase';

// PR — Encuesta in-app. Guarda una respuesta por contexto en la tabla feedback.
// Deduplicamos por contexto con localStorage para no molestar dos veces.

const key = (context: string) => `fina-feedback-${context}`;

export function hasAnsweredFeedback(context: string): boolean {
  try {
    return localStorage.getItem(key(context)) !== null;
  } catch {
    return false;
  }
}

export function markFeedbackAnswered(context: string) {
  try {
    localStorage.setItem(key(context), new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export async function saveFeedback(context: string, rating: number, comment: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('feedback').insert({
      user_id: session?.user?.id ?? null,
      context,
      rating,
      comment: comment.trim() || null,
    });
    if (error) console.error('[fina] saveFeedback:', error.message);
  } catch (e: any) {
    console.error('[fina] saveFeedback threw:', e?.message ?? e);
  }
}

import { idUsuaria, supabase } from './cliente';

// Las mini lecciones que la persona marcó como "ya lo aprendí". Van a `learned_cards`
// (migración 0042) para que pasen de un dispositivo a otro, y SIEMPRE se guardan también
// en el dispositivo: sin la migración corrida la tabla no existe y las cards tienen que
// seguir funcionando igual.

const CLAVE = 'fina_inv_tarjetas_aprendidas';

function leerLocal(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const j: unknown = JSON.parse(crudo);
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function escribirLocal(ids: string[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids));
  } catch {
    /* el almacenamiento puede estar bloqueado: se ve igual en pantalla */
  }
}

/** Lo que hay en el dispositivo, al instante (para no mostrar la pantalla vacía mientras se consulta la base). */
export const leerAprendidasLocal = leerLocal;

/** Los ids de las lecciones que ya marcó como aprendidas. */
export async function leerAprendidas(): Promise<string[]> {
  const local = leerLocal();
  try {
    const uid = await idUsuaria();
    if (!uid) return local;
    const { data, error } = await supabase.from('learned_cards').select('card_id');
    if (error || !data) return local;
    const ids = data.map((f) => String(f.card_id));
    escribirLocal(ids);
    return ids;
  } catch {
    return local;
  }
}

export async function marcarAprendida(id: string, aprendida: boolean): Promise<void> {
  const ahora = leerLocal().filter((x) => x !== id);
  escribirLocal(aprendida ? [...ahora, id] : ahora);
  try {
    const uid = await idUsuaria();
    if (!uid) return;
    if (aprendida) {
      await supabase.from('learned_cards').upsert({ user_id: uid, card_id: id }, { onConflict: 'user_id,card_id' });
    } else {
      await supabase.from('learned_cards').delete().eq('user_id', uid).eq('card_id', id);
    }
  } catch {
    /* sin la migración, o sin red: ya quedó en el dispositivo */
  }
}

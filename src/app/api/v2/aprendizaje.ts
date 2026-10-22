import { diaAR, type Aprendida } from '../../lib/inversiones/aprender';
import { idUsuaria, supabase } from './cliente';

// Las mini lecciones que la persona marcó como "ya lo aprendí", con el día en que lo hizo (hay
// un límite de cuántas por día). Van a `learned_cards` (migración 0042) para que pasen de un
// dispositivo a otro, y SIEMPRE se guardan también en el dispositivo: sin la migración corrida
// la tabla no existe y las cards tienen que seguir funcionando igual.

const CLAVE = 'fina_inv_tarjetas_aprendidas';

function leerLocal(): Aprendida[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const j: unknown = JSON.parse(crudo);
    if (!Array.isArray(j)) return [];
    const salida: Aprendida[] = [];
    for (const x of j) {
      // Lo guardado antes de que hubiera límite eran sólo ids: no se sabe qué día, así que no cuentan para hoy.
      if (typeof x === 'string') salida.push({ id: x, dia: '' });
      else if (typeof x === 'object' && x !== null && typeof (x as Aprendida).id === 'string') {
        salida.push({ id: (x as Aprendida).id, dia: typeof (x as Aprendida).dia === 'string' ? (x as Aprendida).dia : '' });
      }
    }
    return salida;
  } catch {
    return [];
  }
}

function escribirLocal(lista: Aprendida[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* el almacenamiento puede estar bloqueado: se ve igual en pantalla */
  }
}

/** Lo que hay en el dispositivo, al instante (para no mostrar la pantalla vacía mientras se consulta la base). */
export const leerAprendidasLocal = leerLocal;

/** Las lecciones que ya marcó como aprendidas, con el día de cada una. */
export async function leerAprendidas(): Promise<Aprendida[]> {
  const local = leerLocal();
  try {
    const uid = await idUsuaria();
    if (!uid) return local;
    const { data, error } = await supabase.from('learned_cards').select('card_id, learned_at');
    if (error || !data) return local;
    const lista = data.map((f) => ({ id: String(f.card_id), dia: f.learned_at ? diaAR(Date.parse(String(f.learned_at))) : '' }));
    escribirLocal(lista);
    return lista;
  } catch {
    return local;
  }
}

export async function marcarAprendida(id: string, aprendida: boolean, dia: string = diaAR()): Promise<void> {
  const resto = leerLocal().filter((x) => x.id !== id);
  escribirLocal(aprendida ? [...resto, { id, dia }] : resto);
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

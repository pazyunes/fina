// Lo que la app recuerda de los hábitos en este dispositivo: qué recordatorio
// del día se dejó pasar ("Hoy no") y a qué gastos ya se les preguntó si querían
// que se los recordemos. Es una comodidad: si el almacenamiento no anda, todo
// funciona igual y simplemente se vuelve a preguntar.

const DESCARTADOS = 'fina_habitos_descartados';
const PREGUNTADOS = 'fina_habitos_preguntados';

function leer(clave: string): unknown {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}
function escribir(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento: no pasa nada */ }
}

/** ¿Se dijo "Hoy no" a este hábito en este día? */
export function habitoDescartadoHoy(habito: string, hoy: string): boolean {
  const v = leer(DESCARTADOS) as { dia?: string; claves?: unknown } | null;
  return v?.dia === hoy && Array.isArray(v.claves) && v.claves.includes(habito);
}

export function descartarHabitoHoy(habito: string, hoy: string) {
  const v = leer(DESCARTADOS) as { dia?: string; claves?: unknown } | null;
  const claves = v?.dia === hoy && Array.isArray(v.claves) ? v.claves.filter((c): c is string => typeof c === 'string') : [];
  escribir(DESCARTADOS, { dia: hoy, claves: [...claves, habito] });
}

/** ¿Ya se le preguntó si quería que se lo recordemos? Se pregunta una sola vez por gasto. */
export function habitoYaPreguntado(habito: string): boolean {
  const v = leer(PREGUNTADOS);
  return Array.isArray(v) && v.includes(habito);
}

export function marcarHabitoPreguntado(habito: string) {
  const v = leer(PREGUNTADOS);
  const claves = Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : [];
  escribir(PREGUNTADOS, [...new Set([...claves, habito])].slice(-100));
}

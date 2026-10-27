// Qué cierres de mes ya se vieron en este dispositivo, para no mostrar la fila
// de Inicio otra vez. Es una comodidad: sin almacenamiento, vuelve a aparecer.

const CLAVE = 'fina_cierres_vistos';

export function cierreVisto(mes: string): boolean {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(v) && v.includes(mes);
  } catch {
    return false;
  }
}

export function marcarCierreVisto(mes: string) {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    const anteriores = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    localStorage.setItem(CLAVE, JSON.stringify([...new Set([...anteriores, mes])].slice(-12)));
  } catch { /* sin almacenamiento: no pasa nada */ }
}

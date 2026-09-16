// Validar un mail, en un solo lugar: lo usan crear la cuenta, entrar, y
// recuperar la contraseña. Si cada pantalla tuviera su regla, un mail que pasa
// al crear la cuenta podría no pasar al entrar.
//
// No se puede saber si un mail EXISTE sin mandarle algo. Lo que sí se atrapa
// acá es lo que casi seguro es un error de tipeo: sin @, con espacios, dos
// puntos seguidos, o sin terminación (".com", ".ar").

export function normalizarEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function emailValido(v: string): boolean {
  const e = normalizarEmail(v);
  if (e.length > 254 || e.includes('..')) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e);
}

// Los errores de tipeo más comunes en los dominios que usa la gente en
// Argentina. Un "gmial.com" es un mail válido para la regla de arriba, pero a
// esa casilla nunca le va a llegar el link para recuperar la contraseña.
const DOMINIOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'hotmail.com.ar.com': 'hotmail.com.ar', 'yahoo.com.ar.com': 'yahoo.com.ar',
};

/** Si el dominio parece mal escrito, el mail corregido. Si no, null. */
export function sugerenciaEmail(v: string): string | null {
  const e = normalizarEmail(v);
  const [usuario, dominio] = e.split('@');
  if (!usuario || !dominio) return null;
  const corregido = DOMINIOS[dominio];
  return corregido ? `${usuario}@${corregido}` : null;
}

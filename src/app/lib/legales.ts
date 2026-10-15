// Los textos legales viven dentro de la app (ver TextoLegal.tsx) y se leen en
// /onboarding-v2/terminos. Es una ruta pública a propósito: se tiene que poder
// leer ANTES de crear la cuenta, que es cuando se aceptan.
export const TERMINOS_URL: string | null = '/onboarding-v2/terminos';
export const PRIVACIDAD_URL: string | null = '/onboarding-v2/terminos#privacidad';

// Cuándo entró en vigencia la versión actual de los textos. Quien aceptó antes
// de esta fecha (o nunca) tiene que aceptar de nuevo para entrar a la app: la
// aceptación guarda CUÁNDO se aceptó, así que alcanza con compararla acá, sin
// columna de versión. Cada vez que cambien los textos de fondo, se actualiza
// esta fecha.
export const TERMINOS_VIGENTES_DESDE = '2026-10-15T00:00:00-03:00';

export const CONTACTO_DATOS = 'fina.edfinanciera@gmail.com';

export function terminosAlDia(aceptadosEn: string | null): boolean {
  if (!aceptadosEn) return false;
  const aceptado = Date.parse(aceptadosEn);
  return !Number.isNaN(aceptado) && aceptado >= Date.parse(TERMINOS_VIGENTES_DESDE);
}

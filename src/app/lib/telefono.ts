// El teléfono es la llave con la que el bot de WhatsApp reconoce a una persona,
// así que tiene que guardarse de UNA sola forma. Este archivo es esa forma.
//
// Argentina: el número local es área + abonado = 10 dígitos. El "9" de celular
// es opcional al escribirlo, así que se normaliza — "11 5555-6666" y
// "9 11 5555-6666" son el mismo teléfono. También se saca el 0 inicial del
// formato local.
//
// CANÓNICO: `+54` + 10 dígitos, SIN el 9. Es lo que ya está guardado en
// user_profiles.phone y lo que respeta su índice único. El bot recibe los
// números de WhatsApp con el 9 (`549…`), así que del lado del bot hay que
// sacárselo antes de buscar. Ver docs/whatsapp-bot-flujo-v2.md.

export function normalizarTelefonoAr(entrada: string): string {
  let n = entrada.replace(/\D/g, '');
  if (n.startsWith('0')) n = n.slice(1);
  // Ningún código de área argentino empieza con 9, así que un 9 adelante es
  // SIEMPRE el prefijo de celular y se puede sacar sin ambigüedad. Hacerlo
  // apenas aparece (y no sólo cuando el número ya tiene 11 dígitos) es lo que
  // permite que se vaya formateando bien mientras se escribe.
  if (n.startsWith('9')) n = n.slice(1);
  return n;
}

/** `+54XXXXXXXXXX`, o '' si lo que se escribió todavía no es un teléfono. */
export function telefonoE164(entrada: string): string {
  const n = normalizarTelefonoAr(entrada);
  return n.length === 10 ? `+54${n}` : '';
}

export function telefonoValidoAr(entrada: string): boolean {
  return normalizarTelefonoAr(entrada).length === 10;
}

/** Cómo se muestra mientras se escribe: "11 5555-6666". */
export function formatearTelefonoAr(entrada: string): string {
  const d = normalizarTelefonoAr(entrada).slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
}

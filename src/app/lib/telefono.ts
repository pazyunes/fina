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
  // "+54 9 11…" pegado desde WhatsApp o los contactos. Ningún código de área
  // empieza con 5, así que un 54 adelante es el código del país. Sólo desde los
  // 12 dígitos: con menos, alguien que recién empieza a tipear "54" vería que lo
  // que escribe desaparece.
  if (n.startsWith('54') && n.length >= 12) n = n.slice(2);
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
  // 10 dígitos, y un código de área que exista: 11 (Buenos Aires) o uno que
  // empiece con 2 o 3 (el resto del país). Ningún otro código empieza con 1, así
  // que "15 5555-6666" es alguien que puso el 15 y se olvidó el código de área.
  return /^(11\d{8}|[23]\d{9})$/.test(normalizarTelefonoAr(entrada));
}

/** Por qué el teléfono todavía no es válido, para mostrarlo debajo del campo. */
export function problemaTelefonoAr(entrada: string): string | null {
  const n = normalizarTelefonoAr(entrada);
  if (n.length === 0) return 'Campo obligatorio';
  if (n.length > 10) return 'Sobran números. Escribilo con el código de área y sin el 15: por ejemplo, 11 5555-6666';
  if (n.length < 10) return 'Faltan números. Escribilo con el código de área: por ejemplo, 11 5555-6666';
  if (n.startsWith('15')) return 'Parece que falta el código de área, o sobra el 15. Por ejemplo: 11 5555-6666';
  if (!/^(11|[23])/.test(n)) return 'Ese código de área no existe en Argentina. Por ejemplo: 11 para Buenos Aires, 351 para Córdoba';
  return null;
}

/** Cómo se muestra mientras se escribe: "11 5555-6666". */
export function formatearTelefonoAr(entrada: string): string {
  // Hasta 12 dígitos y no 10: si alguien escribe "11 15 5555-6666", cortar en
  // 10 armaría en silencio OTRO número que parece válido. Con los 12 a la vista,
  // la validación le avisa que sobra el 15.
  const d = normalizarTelefonoAr(entrada).slice(0, 12);
  if (d.length > 10) return d;
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
}

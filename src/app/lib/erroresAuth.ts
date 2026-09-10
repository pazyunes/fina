// Los mensajes de Supabase vienen en inglés y en jerga ("User already
// registered", "Invalid login credentials"). Los que se pueden anticipar se
// traducen a algo accionable; el resto se muestra tal cual, porque un mensaje
// raro es más útil que un "algo salió mal" que no dice nada.
//
// Vive acá y no en cada pantalla porque lo usan el alta y el ingreso: si la
// traducción estuviera duplicada, arreglar un mensaje en un lado lo dejaría mal
// en el otro.
export function traducirErrorAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ya hay una cuenta con ese mail. Podés iniciar sesión.';
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'El mail o la contraseña no coinciden. Fijate y probá de nuevo.';
  }
  if (m.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu mail. Buscá el mail que te mandamos y tocá el link.';
  }
  if (m.includes('duplicate') && m.includes('phone')) {
    return 'Ese teléfono ya está usado por otra cuenta.';
  }
  if (m.includes('invalid email')) return 'Ese mail no parece válido.';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No pudimos conectarnos. Fijate la conexión y probá otra vez.';
  }
  return msg;
}

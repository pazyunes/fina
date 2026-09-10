// ── Puerta cerrada ──────────────────────────────────────────────────────
// Mientras se rehace el flujo, la app no se muestra a nadie: toda ruta cae en
// una pantalla de "próximamente". Es una sola constante para poder abrirla de
// nuevo en un commit de una línea.
//
// Cómo entrar mientras está cerrada (para vos y para quien pruebe):
//   abrir  /?ver=fina
// Eso deja una marca en el navegador y desde ahí la app se ve normal en ese
// dispositivo. Para volver a verla cerrada: /?ver=no
//
// NO es seguridad. Cualquiera que sepa el parámetro entra, y el código de la
// app viaja igual al navegador. Sirve para que nadie se tope con la app por
// accidente, no para proteger datos: eso lo hacen las policies de RLS.
export const APP_CERRADA = true;

const LLAVE = 'fina_ver_igual';

// Lee el parámetro una sola vez, al arrancar, y lo persiste. Así el bypass
// sobrevive a la navegación interna sin tener que arrastrar el query.
export function resolverAcceso(): boolean {
  if (!APP_CERRADA) return true;
  try {
    const q = new URLSearchParams(window.location.search).get('ver');
    if (q === 'fina') {
      localStorage.setItem(LLAVE, '1');
      return true;
    }
    if (q === 'no') {
      localStorage.removeItem(LLAVE);
      return false;
    }
    return localStorage.getItem(LLAVE) === '1';
  } catch {
    // Navegador sin storage (privado, storage bloqueado): la puerta queda
    // cerrada, que es el lado seguro para equivocarse.
    return false;
  }
}

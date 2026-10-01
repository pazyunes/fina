import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Fini } from './Fini';
import { COLORS, borrarDatosLocales, marcarSesionDesbloqueada, tieneBloqueoBiometria, verificarBiometria, verificarBloqueoPin } from './shared';
import { cerrarSesion } from '../../api/v2/cuenta';

// Pantalla de bloqueo del dispositivo (PIN / Face ID / Touch ID). No es un
// login: la sesión de Supabase sigue viva, esto sólo tapa la plata hasta que
// la persona vuelve a probar que es ella. Se muestra desde `Puerta`
// (V2Layout) cuando `bloqueoAppActivo()` da true.
export function BloqueoApp({ onDesbloqueado }: { onDesbloqueado: () => void }) {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [probandoBio, setProbandoBio] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const yaIntento = useRef(false);
  const bio = tieneBloqueoBiometria();

  async function probarBiometria() {
    setProbandoBio(true);
    const ok = await verificarBiometria();
    setProbandoBio(false);
    if (ok) onDesbloqueado();
    else inputRef.current?.focus();
  }

  // Con Face ID/Touch ID configurado, se intenta solo al entrar — es más
  // rápido que esperar a que la persona busque el botón. El PIN queda abajo
  // como respaldo (si cancela el sensor, si está oscuro, etc).
  useEffect(() => {
    if (bio && !yaIntento.current) {
      yaIntento.current = true;
      void probarBiometria();
    } else {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmar() {
    if (!pin || verificando) return;
    setVerificando(true);
    const ok = await verificarBloqueoPin(pin);
    setVerificando(false);
    if (ok) { marcarSesionDesbloqueada(); onDesbloqueado(); return; }
    setError(true);
    setPin('');
  }

  async function salir() {
    setSaliendo(true);
    await cerrarSesion();
    borrarDatosLocales();
    navigate('/onboarding-v2/entrar', { replace: true });
  }

  return (
    <div className="min-h-full grid place-items-center px-6 py-16">
      <div className="flex flex-col items-center gap-3.5 w-full max-w-xs">
        <Fini state="idle" size={110} />
        <p className="text-[19px] font-bold text-center" style={{ color: COLORS.ink }}>Ingresá tu PIN</p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          aria-label="PIN"
          className="v2-focus w-full rounded-2xl px-4 py-3.5 text-[24px] text-center tracking-[0.5em] transition-colors"
          style={{ background: COLORS.surface, border: `1.5px solid ${error ? COLORS.coralDark : COLORS.lineStrong}`, color: COLORS.ink }}
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void confirmar(); }}
        />
        {error && <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>PIN incorrecto. Probá de nuevo.</p>}
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={!pin || verificando}
          className="v2-focus w-full rounded-2xl py-3.5 text-[17px] font-bold v2-disabled transition-all duration-100 active:scale-[0.98]"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          {verificando ? 'Comprobando…' : 'Entrar'}
        </button>
        {bio && (
          <button
            type="button"
            onClick={() => void probarBiometria()}
            disabled={probandoBio}
            className="v2-focus text-[15px] font-semibold underline"
            style={{ color: COLORS.brand }}
          >
            {probandoBio ? 'Esperando…' : 'Usar Face ID / Touch ID'}
          </button>
        )}

        {!confirmarSalida ? (
          <button type="button" onClick={() => setConfirmarSalida(true)} className="v2-focus mt-1 text-[14px] font-semibold" style={{ color: COLORS.inkFaint }}>
            ¿Olvidaste tu PIN?
          </button>
        ) : (
          <div className="rounded-2xl px-4 py-3.5 flex flex-col gap-3 w-full" style={{ background: COLORS.tint }} role="group" aria-label="Olvidaste tu PIN">
            <p className="text-[14px] leading-snug" style={{ color: COLORS.ink }}>
              No hay forma de recuperarlo: hay que cerrar sesión en este dispositivo y volver a entrar con tu mail y contraseña.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmarSalida(false)} disabled={saliendo} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
                Cancelar
              </button>
              <button type="button" onClick={() => void salir()} disabled={saliendo} className="v2-focus flex-1 rounded-xl min-h-[44px] text-[14px] font-bold v2-disabled" style={{ background: COLORS.ink, color: COLORS.paper }}>
                {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

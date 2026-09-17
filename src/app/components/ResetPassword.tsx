import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { LLEGADA_DESDE_MAIL, supabase } from '../lib/supabase';
import { traducirErrorAuth } from '../lib/erroresAuth';
import { FiniPresenta } from './onboarding-v2/FiniDice';
import { Campo, emailValido, InputContrasena, inputClass, inputStyle } from './onboarding-v2/EntrarV2';
import { IconChevron } from './onboarding-v2/FinaIcons';
import { Apoyo, COLOR_VARS, COLORS, Cta, DeviceFrame, FONT_VARS, LogoFina, Titulo } from './onboarding-v2/shared';

// Poner una contraseña nueva: la pantalla a la que lleva el link del mail de
// "¿Olvidaste tu contraseña?". Con el diseño de la app nueva.
//
// Supabase procesa el link y abre una sesión de recuperación; acá la persona
// elige la contraseña nueva. Si el link llegó a la página principal en vez de
// acá (ver LLEGADA_DESDE_MAIL en lib/supabase.ts), App.tsx la trae a esta
// pantalla.
//
// Estados:
//   · validando  — esperando que Supabase lea el link;
//   · formulario — hay sesión de recuperación: se pide la contraseña;
//   · vencido    — el link venció, ya se usó, o se entró sin link: se explica y
//                  se ofrece mandar otro sin salir de acá;
//   · listo      — contraseña cambiada: a Home.

// La misma regla que al crear la cuenta (OnboardingV2): cambiar la contraseña no
// puede ser la puerta para poner una más débil.
function passwordValida(v: string) { return v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v); }

type Estado = 'validando' | 'formulario' | 'vencido' | 'listo';

export function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, sendPasswordReset } = useAuth();

  const [estado, setEstado] = useState<Estado>(LLEGADA_DESDE_MAIL.errorDeLink ? 'vencido' : 'validando');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [intento, setIntento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para pedir otro link desde "vencido".
  const [email, setEmail] = useState('');
  const [mailEnviado, setMailEnviado] = useState(false);

  useEffect(() => {
    if (LLEGADA_DESDE_MAIL.errorDeLink) return;
    let vivo = true;
    // getSession espera a que Supabase termine de leer el link: si después de
    // eso no hay sesión, no se entró con un link válido.
    void supabase.auth.getSession().then(({ data }) => {
      if (vivo) setEstado((e) => (e === 'validando' ? (data.session ? 'formulario' : 'vencido') : e));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY' || sesion) setEstado((e) => (e === 'validando' || e === 'vencido' ? 'formulario' : e));
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  // Al terminar, a Home. Con una pausa corta para que se lea el "listo".
  useEffect(() => {
    if (estado !== 'listo') return;
    const t = window.setTimeout(() => navigate('/onboarding-v2/home', { replace: true }), 1800);
    return () => window.clearTimeout(t);
  }, [estado, navigate]);

  const pwOk = passwordValida(pw);
  const coinciden = pw === pw2;

  async function guardar() {
    if (trabajando) return;
    setIntento(true);
    if (!pwOk || !coinciden) return;
    setTrabajando(true);
    setError(null);
    const r = await updatePassword(pw);
    setTrabajando(false);
    if (r.error) {
      const msg = traducirErrorAuth(r.error);
      // Si la sesión de recuperación ya no existe, no sirve reintentar: hay
      // que pedir otro link.
      if (/link ya no sirve/.test(msg)) { setEstado('vencido'); return; }
      setError(msg);
      return;
    }
    setEstado('listo');
  }

  async function pedirOtro() {
    if (trabajando) return;
    setIntento(true);
    if (!emailValido(email)) return;
    setTrabajando(true);
    setError(null);
    const r = await sendPasswordReset(email.trim());
    setTrabajando(false);
    if (r.error) { setError(traducirErrorAuth(r.error)); return; }
    setMailEnviado(true);
  }

  return (
    <DeviceFrame>
      <div className="flex-1 min-h-0 flex flex-col" style={{ background: COLORS.paper, ...FONT_VARS, ...COLOR_VARS }}>
        <header className="px-6 pt-5 pb-1 flex items-center gap-3 w-full lg:max-w-xl lg:mx-auto lg:pt-10">
          {estado !== 'listo' && (
            <button
              type="button"
              onClick={() => navigate('/onboarding-v2/entrar')}
              aria-label="Volver a entrar"
              className="v2-focus shrink-0 w-11 h-11 -ml-2.5 flex items-center justify-center rounded-full transition-all duration-100 active:scale-90"
              style={{ color: COLORS.ink }}
            >
              <IconChevron size={22} style={{ transform: 'rotate(180deg)' }} />
            </button>
          )}
          {estado === 'listo' && <span className="w-11 shrink-0 lg:hidden" aria-hidden />}
          <div className="flex-1 flex justify-center lg:hidden"><LogoFina alto={28} /></div>
          <span className="w-11 shrink-0 lg:hidden" aria-hidden />
        </header>

        <div className="flex-1 min-h-0 flex flex-col px-6 pt-2 pb-4 overflow-y-auto v2-sin-barra w-full lg:max-w-xl lg:mx-auto">
          <div className="flex flex-col gap-5 my-auto w-full pb-[10vh]">
            {estado === 'validando' && (
              <>
                <FiniPresenta dice="Un segundo, estoy revisando el link…" state="pensando" size={124} />
                <p role="status" className="sr-only">Validando el link del mail</p>
              </>
            )}

            {estado === 'formulario' && (
              <>
                <FiniPresenta dice="Elegí una que te acuerdes." state="idle" size={124} />
                <Titulo>Poné tu contraseña nueva</Titulo>
                <Campo
                  label="Contraseña nueva"
                  error={intento && !pwOk ? 'Mínimo 8 caracteres, con una mayúscula, un número y un carácter especial' : undefined}
                >
                  <InputContrasena
                    className={inputClass}
                    style={inputStyle(intento && !pwOk)}
                    placeholder="Tu contraseña nueva"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </Campo>
                <Campo label="Repetila" error={intento && pwOk && !coinciden ? 'Las dos contraseñas no coinciden' : undefined}>
                  <InputContrasena
                    className={inputClass}
                    style={inputStyle(intento && pwOk && !coinciden)}
                    placeholder="La misma otra vez"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') void guardar(); }}
                  />
                </Campo>
                {error && <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
              </>
            )}

            {estado === 'vencido' && (mailEnviado ? (
              <>
                <FiniPresenta dice="Fijate en tu correo — si no aparece, mirá en spam." state="registro" size={124} />
                <Titulo>Te mandamos otro link</Titulo>
                <Apoyo>
                  Si hay una cuenta con {email.trim()}, te llega un mail nuevo. Abrilo desde este mismo celular o compu.
                </Apoyo>
              </>
            ) : (
              <>
                <FiniPresenta dice="Ese link ya no sirve, pero lo arreglamos." state="idle" size={124} />
                <Titulo>Pedí un link nuevo</Titulo>
                <Apoyo>
                  Los links para cambiar la contraseña vencen en una hora y sirven una sola vez. Escribí tu mail y te mandamos otro.
                </Apoyo>
                <Campo label="Mail" error={intento && !emailValido(email) ? (email.trim() ? 'Ese mail no parece válido' : 'Campo obligatorio') : undefined}>
                  <input
                    className={inputClass}
                    style={inputStyle(intento && !emailValido(email))}
                    placeholder="vos@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    onKeyDown={(e) => { if (e.key === 'Enter') void pedirOtro(); }}
                  />
                </Campo>
                {error && <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
              </>
            ))}

            {estado === 'listo' && (
              <>
                <FiniPresenta dice="¡Listo! Ya podés entrar con tu contraseña nueva." state="logro" size={132} />
                <Titulo>Cambiaste tu contraseña</Titulo>
                <Apoyo>Te llevamos a tu FINA…</Apoyo>
              </>
            )}
          </div>
        </div>

        <div className="px-6 pt-3 pb-6 flex flex-col gap-2.5 w-full lg:max-w-xl lg:mx-auto lg:pb-10">
          {estado === 'formulario' && (
            <Cta label={trabajando ? 'Guardando…' : 'Guardar contraseña'} disabled={trabajando} onClick={() => void guardar()} />
          )}
          {estado === 'vencido' && !mailEnviado && (
            <Cta label={trabajando ? 'Mandando…' : 'Mandarme otro link'} disabled={trabajando} onClick={() => void pedirOtro()} />
          )}
          {estado === 'vencido' && mailEnviado && (
            <Cta label="Volver a entrar" onClick={() => navigate('/onboarding-v2/entrar')} />
          )}
          {estado === 'listo' && (
            <Cta label="Ir a mi FINA" onClick={() => navigate('/onboarding-v2/home', { replace: true })} />
          )}
        </div>
      </div>
    </DeviceFrame>
  );
}

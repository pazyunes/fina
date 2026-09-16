import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { traducirErrorAuth } from '../../lib/erroresAuth';
import { emailValido, sugerenciaEmail } from '../../lib/email';
import { emailTieneCuenta } from '../../api/v2/cuenta';
import { FiniPresenta } from './FiniDice';
import {
  Apoyo, COLOR_VARS, COLORS, Cta, DeviceFrame, FONT_VARS, Titulo, BotonFantasma,
} from './shared';
import { IconChevron, IconOjo, IconOjoTachado } from './FinaIcons';

// Ingresar con una cuenta que ya existe, en el diseño del flujo nuevo.
//
// El `/login` viejo sigue existiendo y sigue siendo el del flujo anterior: esta
// pantalla NO lo reemplaza, es la puerta del v2. Se llega desde "Ya tengo
// cuenta" en la bienvenida — que es el caso real de alguien que se cambió de
// teléfono o cerró sesión.
//
// Recuperar la contraseña vive acá adentro y no en otra ruta: son tres campos y
// un botón, y mandar a la persona a otra pantalla para escribir el mismo mail
// que ya escribió es hacerle repetir el trabajo.

// La regla vive en lib/email.ts; se reexporta porque otras pantallas la toman de acá.
export { emailValido };

export const inputClass = 'v2-focus rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors w-full';
export function inputStyle(err = false): React.CSSProperties {
  return { background: COLORS.surface, color: COLORS.ink, border: `1px solid ${err ? COLORS.naranja : COLORS.line}` };
}

export function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>{label}</label>
      {children}
      {error && <p className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
    </div>
  );
}

/**
 * Campo de contraseña con el ojito para verla. Escribir una contraseña larga,
 * con mayúscula, número y símbolo, sin poder ver qué se tipeó es la causa más
 * común de "no me deja entrar" — sobre todo en el celular.
 */
export function InputContrasena({ style, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className ?? ''} w-full pr-14`} style={style} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="v2-focus absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center"
        style={{ color: COLORS.inkSoft }}
      >
        {visible ? <IconOjoTachado size={20} /> : <IconOjo size={20} />}
      </button>
    </div>
  );
}

/** Si el dominio del mail parece mal escrito ("gmial.com"), se ofrece corregirlo. */
export function SugerenciaMail({ email, onUsar }: { email: string; onUsar: (corregido: string) => void }) {
  const sugerido = sugerenciaEmail(email);
  if (!sugerido) return null;
  return (
    <button
      type="button"
      onClick={() => onUsar(sugerido)}
      className="v2-focus self-start text-left text-[15px] rounded-lg py-1"
      style={{ color: COLORS.inkSoft }}
    >
      ¿Quisiste decir <strong style={{ color: COLORS.brand }}>{sugerido}</strong>?
    </button>
  );
}

function AvisoSinCuenta({ email, onCrear }: { email: string; onCrear: () => void }) {
  return (
    <div role="alert" className="rounded-2xl px-4 py-3.5 flex flex-col gap-2.5" style={{ background: COLORS.brandSoft }}>
      <p className="text-[16px] leading-snug" style={{ color: COLORS.ink }}>
        No tenés una cuenta con <strong>{email.trim()}</strong>. Fijate que esté bien escrito, o creá una: son un par de preguntas.
      </p>
      <button
        type="button"
        onClick={onCrear}
        className="v2-focus self-start min-h-[44px] px-4 rounded-full text-[15px] font-bold"
        style={{ background: COLORS.brand, color: COLORS.surface }}
      >
        Crear mi cuenta
      </button>
    </div>
  );
}

export function EntrarV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, sendPasswordReset, session, loading } = useAuth();
  // Si viene desde "crear cuenta" con un mail que ya tenía cuenta, llega escrito.
  const emailInicial = (location.state as { email?: string } | null)?.email ?? '';

  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar');
  const [email, setEmail] = useState(emailInicial);
  // No hay cuenta con ese mail: se dice eso y se ofrece crearla, en vez del
  // "mail o contraseña incorrectos" que no deja saber qué pasó.
  const [sinCuenta, setSinCuenta] = useState(false);
  const [password, setPassword] = useState('');
  const [intento, setIntento] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailEnviado, setMailEnviado] = useState(false);

  // Con sesión no hay nada que hacer acá.
  useEffect(() => {
    if (!loading && session) navigate('/onboarding-v2/home', { replace: true });
  }, [loading, session, navigate]);

  const emailOk = emailValido(email);

  async function entrar() {
    if (trabajando) return;
    setIntento(true);
    if (!emailOk || password.length === 0) return;
    setTrabajando(true);
    setError(null);
    setSinCuenta(false);
    const r = await signIn(email.trim(), password);
    if (r.error) {
      // Supabase contesta lo mismo si no existe la cuenta que si la contraseña
      // está mal. Se pregunta cuál de las dos es.
      if (/invalid login credentials|invalid credentials/i.test(r.error)) {
        const existe = await emailTieneCuenta(email);
        setTrabajando(false);
        if (existe === false) { setSinCuenta(true); return; }
        if (existe === true) { setError('La contraseña no es correcta. Probá de nuevo o recuperala.'); return; }
      }
      setTrabajando(false);
      setError(traducirErrorAuth(r.error));
      return;
    }
    setTrabajando(false);
    navigate('/onboarding-v2/home', { replace: true });
  }

  async function recuperar() {
    if (trabajando) return;
    setIntento(true);
    if (!emailOk) return;
    setTrabajando(true);
    setError(null);
    setSinCuenta(false);
    // Si no hay cuenta con ese mail, mandar un link no sirve: nunca va a llegar.
    const existe = await emailTieneCuenta(email);
    if (existe === false) { setTrabajando(false); setSinCuenta(true); return; }
    const r = await sendPasswordReset(email.trim());
    setTrabajando(false);
    if (r.error) { setError(traducirErrorAuth(r.error)); return; }
    setMailEnviado(true);
  }

  return (
    <DeviceFrame>
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{ background: COLORS.paper, ...FONT_VARS, ...COLOR_VARS }}
      >
        <header className="px-6 pt-5 pb-1 flex items-center gap-3 w-full lg:max-w-xl lg:mx-auto lg:pt-10">
          <button
            type="button"
            onClick={() => (modo === 'recuperar' ? (setModo('entrar'), setMailEnviado(false), setError(null)) : navigate('/onboarding-v2'))}
            aria-label="Volver"
            className="v2-focus shrink-0 w-11 h-11 -ml-2.5 flex items-center justify-center rounded-full transition-all duration-100 active:scale-90"
            style={{ color: COLORS.ink }}
          >
            <IconChevron size={22} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex flex-col px-6 pt-2 pb-4 overflow-y-auto v2-sin-barra w-full lg:max-w-xl lg:mx-auto">
          <div className="flex flex-col gap-5 my-auto w-full pb-[10vh]">
            {mailEnviado ? (
              <>
                <FiniPresenta
                  dice="Fijate en tu correo — si no aparece, mirá en spam."
                  state="registro"
                  size={132}
                />
                <Titulo>Te mandamos el mail</Titulo>
                <Apoyo>
                  Te llega a {email.trim()} un link para poner una contraseña nueva. Vence en una hora.
                </Apoyo>
              </>
            ) : modo === 'recuperar' ? (
              <>
                <FiniPresenta
                  dice="Tranqui, le pasa a cualquiera."
                  state="idle"
                  size={124}
                />
                <Titulo>Recuperá tu contraseña</Titulo>
                <Apoyo>Escribí tu mail y te mandamos un link para poner una nueva.</Apoyo>
                <Campo label="Mail" error={intento && !emailOk ? (email.trim() ? 'Ese mail no parece válido' : 'Campo obligatorio') : undefined}>
                  <input
                    className={inputClass}
                    style={inputStyle(intento && !emailOk)}
                    placeholder="vos@mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setSinCuenta(false); }}
                    autoComplete="email"
                    onKeyDown={(e) => { if (e.key === 'Enter') void recuperar(); }}
                  />
                </Campo>
                <SugerenciaMail email={email} onUsar={(c) => { setEmail(c); setSinCuenta(false); }} />
                {sinCuenta && <AvisoSinCuenta email={email} onCrear={() => navigate('/onboarding-v2', { state: { email: email.trim() } })} />}
                {error && <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
              </>
            ) : (
              <>
                <FiniPresenta
                  dice="¡Qué bueno tenerte de vuelta!"
                  state="saludo"
                  size={124}
                />
                <Titulo>Volvé a entrar</Titulo>
                <Apoyo>Con tu mail y tu contraseña, todo tuyo vuelve como lo dejaste.</Apoyo>

                <Campo label="Mail" error={intento && !emailOk ? (email.trim() ? 'Ese mail no parece válido' : 'Campo obligatorio') : undefined}>
                  <input
                    className={inputClass}
                    style={inputStyle(intento && !emailOk)}
                    placeholder="vos@mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setSinCuenta(false); }}
                    autoComplete="email"
                  />
                </Campo>
                <SugerenciaMail email={email} onUsar={(c) => { setEmail(c); setSinCuenta(false); }} />
                <Campo label="Contraseña" error={intento && password.length === 0 ? 'Campo obligatorio' : undefined}>
                  <InputContrasena
                    className={inputClass}
                    style={inputStyle(intento && password.length === 0)}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') void entrar(); }}
                  />
                </Campo>

                {sinCuenta && <AvisoSinCuenta email={email} onCrear={() => navigate('/onboarding-v2', { state: { email: email.trim() } })} />}
                {error && <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}

                <button
                  type="button"
                  onClick={() => { setModo('recuperar'); setError(null); setIntento(false); setSinCuenta(false); }}
                  className="v2-focus self-start text-[16px] font-semibold underline rounded-full py-2"
                  style={{ color: COLORS.brand }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 pt-3 pb-6 flex flex-col gap-2.5 w-full lg:max-w-xl lg:mx-auto lg:pb-10">
          {mailEnviado ? (
            <Cta label="Volver a entrar" onClick={() => { setMailEnviado(false); setModo('entrar'); }} />
          ) : modo === 'recuperar' ? (
            <Cta label={trabajando ? 'Mandando…' : 'Mandarme el link'} disabled={trabajando} onClick={() => void recuperar()} />
          ) : (
            <>
              <Cta label={trabajando ? 'Entrando…' : 'Entrar'} disabled={trabajando} onClick={() => void entrar()} />
              <BotonFantasma label="No tengo cuenta — quiero crear una" onClick={() => navigate('/onboarding-v2')} />
            </>
          )}
        </div>
      </div>
    </DeviceFrame>
  );
}

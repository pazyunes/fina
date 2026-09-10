import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { traducirErrorAuth } from '../../lib/erroresAuth';
import { FiniPresenta } from './FiniDice';
import {
  Apoyo, COLOR_VARS, COLORS, Cta, DeviceFrame, FONT_VARS, Titulo, BotonFantasma,
} from './shared';
import { IconChevron } from './FinaIcons';

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

function emailValido(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

const inputClass = 'v2-focus rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors w-full';
function inputStyle(err = false): React.CSSProperties {
  return { background: COLORS.surface, color: COLORS.ink, border: `1px solid ${err ? COLORS.naranja : COLORS.line}` };
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>{label}</label>
      {children}
      {error && <p className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
    </div>
  );
}

export function EntrarV2() {
  const navigate = useNavigate();
  const { signIn, sendPasswordReset, session, loading } = useAuth();

  const [modo, setModo] = useState<'entrar' | 'recuperar'>('entrar');
  const [email, setEmail] = useState('');
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
    const r = await signIn(email.trim(), password);
    setTrabajando(false);
    if (r.error) { setError(traducirErrorAuth(r.error)); return; }
    navigate('/onboarding-v2/home', { replace: true });
  }

  async function recuperar() {
    if (trabajando) return;
    setIntento(true);
    if (!emailOk) return;
    setTrabajando(true);
    setError(null);
    const r = await sendPasswordReset(email.trim());
    setTrabajando(false);
    if (r.error) { setError(traducirErrorAuth(r.error)); return; }
    // Se confirma pase lo que pase del lado de Supabase: decir "ese mail no
    // existe" le contaría a cualquiera qué direcciones tienen cuenta en FINA.
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

        <div className="flex-1 min-h-0 flex flex-col px-6 pt-2 pb-4 overflow-y-auto w-full lg:max-w-xl lg:mx-auto">
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
                  Si hay una cuenta con {email.trim()}, te llega un link para poner una contraseña nueva.
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
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    onKeyDown={(e) => { if (e.key === 'Enter') void recuperar(); }}
                  />
                </Campo>
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
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Campo>
                <Campo label="Contraseña" error={intento && password.length === 0 ? 'Campo obligatorio' : undefined}>
                  <input
                    type="password"
                    className={inputClass}
                    style={inputStyle(intento && password.length === 0)}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => { if (e.key === 'Enter') void entrar(); }}
                  />
                </Campo>

                {error && <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}

                <button
                  type="button"
                  onClick={() => { setModo('recuperar'); setError(null); setIntento(false); }}
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

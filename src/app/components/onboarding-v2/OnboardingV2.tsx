import { useState } from 'react';
import { motion } from 'motion/react';

// REDISEÑO — Onboarding v2 (rama feat/rediseno-onboarding-v2)
//
// Sandbox aislado para iterar el onboarding sin tocar el flujo real
// (/personal-data, /activity, etc.), que sigue en producción sin cambios.
// Vive en su propia ruta pública (/onboarding-v2, ver routes.tsx) para poder
// iterarlo sin necesitar sesión ni tocar Supabase todavía — el estado es
// 100% local. Cuando el diseño se cierre, esto se porta al flujo real
// (UserData, Supabase, el resto del router).
//
// Estética: "rubber hose vintage / Y2K mascot" — pedido explícito para esta
// v2, distinta de la paleta violeta actual de FINA. Paleta propia abajo.
// Basado en el boceto a mano + benchmarks (Gasti, Duolingo, Headspace) que
// ya charlamos: preguntas antes de pedir cuenta, sin montos de plata en
// ningún paso, "Otro" siempre con campo de texto, cada respuesta con una
// devolución cálida (nunca un camino que se sienta juzgado).

const COLORS = {
  mint: '#2ECC71',
  mintLight: '#8EFEA0',
  cream: '#FFF8E7',
  yellow: '#FCE042',
  yellowSoft: '#FFF3B0',
  ink: '#1E1E1E',
  coral: '#FF6B81',
  coralSoft: '#FFE1E6',
};

type Genero = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir' | null;
type Edad = '12-17' | '18-24' | '25-34' | '35-44' | '45+' | 'otro' | null;
type Situacion = 'trabaja' | 'estudia' | 'ambas' | 'ninguna' | 'otro' | null;
type ObjetivoId = 'ahorrar' | 'invertir' | 'controlar' | 'objetivo' | 'otro';
type HoyId = 'ahorro' | 'invierto' | 'controlo' | 'nunca_supe' | 'nunca_intente' | 'abandone' | 'otro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';

const COLOR_DOTS: { id: string; hex: string }[] = [
  { id: 'coral', hex: COLORS.coral },
  { id: 'yellow', hex: COLORS.yellow },
  { id: 'mint', hex: COLORS.mint },
  { id: 'sky', hex: '#6BC1FF' },
  { id: 'cream', hex: '#F0E4C8' },
];

const GENEROS: { id: Genero; label: string }[] = [
  { id: 'femenino', label: 'Femenino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'otro', label: 'Otro' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const EDADES: { id: Edad; label: string }[] = [
  { id: '12-17', label: '12 a 17' },
  { id: '18-24', label: '18 a 24' },
  { id: '25-34', label: '25 a 34' },
  { id: '35-44', label: '35 a 44' },
  { id: '45+', label: '45 o más' },
  { id: 'otro', label: 'Otro' },
];

const SITUACIONES: { id: Situacion; label: string; emoji: string }[] = [
  { id: 'trabaja', label: 'Laburando', emoji: '💼' },
  { id: 'estudia', label: 'Estudiando', emoji: '📚' },
  { id: 'ambas', label: 'Ambas', emoji: '💼📚' },
  { id: 'ninguna', label: 'Ninguna', emoji: '🌤️' },
  { id: 'otro', label: 'Otro', emoji: '✍️' },
];

const OBJETIVOS: { id: ObjetivoId; label: string; emoji: string }[] = [
  { id: 'ahorrar', label: 'Ahorrar', emoji: '🐷' },
  { id: 'invertir', label: 'Invertir', emoji: '🌱' },
  { id: 'controlar', label: 'Controlar mis gastos', emoji: '🔍' },
  { id: 'objetivo', label: 'Lograr objetivos puntuales', emoji: '🎯' },
  { id: 'otro', label: 'Otro', emoji: '✍️' },
];

const BUBBLE_POR_TOP: Record<ObjetivoId, string> = {
  ahorrar: 'Modo ahorro: ON',
  invertir: 'Vos sí que sabés lo que es bueno para vos',
  controlar: 'Ocuparte de esto ya es un montón — arranquemos.',
  objetivo: 'Con la mira puesta en lo que importa, siempre.',
  otro: 'Lo que sea, te acompañamos a lograrlo.',
};

const HOY: { id: HoyId; label: string }[] = [
  { id: 'ahorro', label: 'Ya ahorro' },
  { id: 'invierto', label: 'Ya invierto' },
  { id: 'controlo', label: 'Ya controlo mis gastos' },
  { id: 'nunca_supe', label: 'Nunca supe cómo empezar' },
  { id: 'nunca_intente', label: 'Nunca lo intenté' },
  { id: 'abandone', label: 'Intenté y abandoné' },
  { id: 'otro', label: 'Otro' },
];
const HOY_VULNERABLES: HoyId[] = ['nunca_supe', 'nunca_intente', 'abandone'];

const COMO_VIENES: { id: ComoVieneId; label: string; msg: string }[] = [
  { id: 'justo', label: 'Me alcanza justo', msg: 'Genial — vamos a ayudarte a que te sobre cada vez más.' },
  { id: 'sobra', label: 'Me sobra un poco', msg: 'Buenísimo, te ayudamos a que ese sobrante trabaje para vos.' },
  { id: 'no_llega', label: 'No llego a fin de mes', msg: 'No te preocupes, vinimos justo para eso.' },
  { id: 'hago_lo_que_quiero', label: 'Hago lo que quiero', msg: 'Como a vos te gusta — te ayudamos a que te dure más.' },
  { id: 'no_lo_tengo_en_cuenta', label: 'No lo tengo muy en cuenta', msg: 'Te vamos a hacer mucho más fácil tenerlo en cuenta.' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', msg: 'Todo bien — lo vamos descubriendo juntas, a tu ritmo.' },
  { id: 'otro', label: 'Otro', msg: 'Sea lo que sea, acá vas a poder resolverlo.' },
];

// ── Chip reutilizable — el estilo "rubber hose": borde grueso + sombra dura ──
function Chip({ on, warm, onClick, children }: { on: boolean; warm?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl border-[2.5px] border-[#1E1E1E] px-4 py-2.5 text-[14.5px] font-semibold
        transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        shadow-[3px_3px_0_#1E1E1E]
        ${on ? (warm ? 'bg-[#FF6B81] text-white' : 'bg-[#2ECC71] text-[#1E1E1E]') : 'bg-white text-[#1E1E1E]'}`}
    >
      {children}
    </button>
  );
}

function Cta({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-full border-[2.5px] border-[#1E1E1E] py-4 text-[16px] font-bold
        transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        ${disabled
          ? 'bg-[#e8e3d0] text-[#a8a394] border-[#e8e3d0] shadow-none cursor-not-allowed'
          : 'bg-[#2ECC71] text-[#1E1E1E] shadow-[4px_4px_0_#1E1E1E]'}`}
    >
      {label}
    </button>
  );
}

// La "carita" — ojos ovalados estilo retro + cejas flotantes, se pinta con el
// color elegido en el paso 1. `mood` cambia la boca (neutral/feliz).
function Face({ color, size = 150, mood = 'neutral' }: { color: string; size?: number; mood?: 'neutral' | 'happy' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 150 150">
      <circle cx="75" cy="75" r="62" fill={color} stroke="#1E1E1E" strokeWidth="4" />
      {mood === 'neutral' ? (
        <>
          <path d="M48 55 Q56 46 64 55" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M86 55 Q94 46 102 55" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="58" cy="70" rx="13" ry="16" fill="#fff" stroke="#1E1E1E" strokeWidth="3" />
          <ellipse cx="92" cy="70" rx="13" ry="16" fill="#fff" stroke="#1E1E1E" strokeWidth="3" />
          <circle cx="60" cy="74" r="4.5" fill="#1E1E1E" />
          <circle cx="94" cy="74" r="4.5" fill="#1E1E1E" />
          <path d="M58 98 Q75 112 92 98" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M46 52 Q56 42 66 50" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M84 50 Q94 42 104 52" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M46 68 Q58 52 70 68" stroke="#1E1E1E" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M80 68 Q92 52 104 68" stroke="#1E1E1E" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M55 96 Q75 118 95 96" stroke="#1E1E1E" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M1 5.5L5 9.5L13 1.5" stroke="#1E1E1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OnboardingV2() {
  const [step, setStep] = useState(0);
  const [color, setColor] = useState<string | null>(null);
  const [genero, setGenero] = useState<Genero>(null);
  const [generoOtroTxt, setGeneroOtroTxt] = useState('');
  const [edad, setEdad] = useState<Edad>(null);
  const [edadOtroTxt, setEdadOtroTxt] = useState('');
  const [situacion, setSituacion] = useState<Situacion>(null);
  const [situacionOtroTxt, setSituacionOtroTxt] = useState('');
  const [rank, setRank] = useState<ObjetivoId[]>([]);
  const [objetivoOtroTxt, setObjetivoOtroTxt] = useState('');
  const [hoy, setHoy] = useState<HoyId[]>([]);
  const [hoyOtroTxt, setHoyOtroTxt] = useState('');
  const [comoViene, setComoViene] = useState<ComoVieneId | null>(null);
  const [comoVieneOtroTxt, setComoVieneOtroTxt] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [finished, setFinished] = useState(false);

  const toggleRank = (id: ObjetivoId) =>
    setRank((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleHoy = (id: HoyId) =>
    setHoy((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  const joven = edad === '12-17' || edad === '18-24';
  const vulnerable = HOY_VULNERABLES.some((id) => hoy.includes(id));
  const comoVieneMsg = comoViene ? COMO_VIENES.find((o) => o.id === comoViene)?.msg : null;
  const objetivoBubble = rank.length ? BUBBLE_POR_TOP[rank[0]] : 'No te vas a arrepentir...';

  function stepValid(s: number): boolean {
    if (s === 1) return !!color;
    if (s === 2) return !!genero && !!edad;
    if (s === 3) return !!situacion;
    if (s === 4) return rank.length > 0;
    if (s === 8) return email.trim().length > 0 && password.length >= 6;
    return true;
  }

  function onNext() {
    if (!stepValid(step)) return;
    if (step === 8) { setFinished(true); return; }
    setStep((s) => Math.min(s + 1, 8));
  }
  function onSkip() {
    setStep((s) => Math.min(s + 1, 8));
  }

  const ctaLabels = ['Empezar', 'Continuar', 'Continuar', 'Continuar', 'Continuar', 'Continuar', 'Ya lo vi, seguimos', 'Continuar', 'Empezar'];
  const showTop = step > 0 && step < 8 && !finished;
  const progressPct = Math.round((step / 8) * 100);

  return (
    <div className="min-h-screen flex flex-col lg:items-center" style={{ background: COLORS.cream }}>
      <div className="w-full flex flex-col flex-1 lg:max-w-[480px]">
        {showTop && (
          <div className="px-[22px] pt-5 pb-1">
            <div className="h-[5px] rounded-full border-[1.5px] border-[#1E1E1E] bg-white overflow-hidden">
              <div className="h-full bg-[#2ECC71]" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col px-[22px] py-4 overflow-y-auto gap-4">
          <motion.div
              key={finished ? 'finished' : step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* STEP 0 — checklist premio */}
              {step === 0 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E] leading-tight">
                    Llegó tu momento de cambiar la historia de tus finanzas 💪
                  </h1>
                  <div className="flex flex-col gap-3 bg-white border-[2.5px] border-[#1E1E1E] rounded-[18px] p-[18px] shadow-[5px_5px_0_#1E1E1E]">
                    {['Conocé tus gastos', 'Lográ tus objetivos', 'Cuidá tu bienestar financiero'].map((txt) => (
                      <div key={txt} className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1E1E1E]">
                        <span className="w-[26px] h-[26px] rounded-full bg-[#2ECC71] border-2 border-[#1E1E1E] flex items-center justify-center shrink-0">
                          <CheckIcon />
                        </span>
                        {txt}
                      </div>
                    ))}
                  </div>
                  <p className="text-[14px] text-[#5b5b52]">Todo esto, a tu ritmo — no hace falta que sepas nada todavía.</p>
                </>
              )}

              {/* STEP 1 — elegir color */}
              {step === 1 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">Antes que nada... elegí un color para tu perfil</h1>
                  <div className="flex justify-center py-2">
                    <Face color={color ?? '#E6DCEE'} />
                  </div>
                  <div className="flex justify-center gap-3.5 pt-1.5">
                    {COLOR_DOTS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.hex)}
                        className="w-[34px] h-[34px] rounded-full border-[2.5px] border-[#1E1E1E]"
                        style={{ background: c.hex, outline: color === c.hex ? '3px solid #1E1E1E' : undefined, outlineOffset: color === c.hex ? '2px' : undefined }}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* STEP 2 — genero + edad */}
              {step === 2 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">¿Con qué género te identificás?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {GENEROS.map((o) => (
                      <Chip key={o.id} on={genero === o.id} onClick={() => setGenero(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {genero === 'otro' && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos cómo te identificás"
                      value={generoOtroTxt}
                      onChange={(e) => setGeneroOtroTxt(e.target.value)}
                    />
                  )}
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E] mt-2.5">¿Qué edad tenés?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {EDADES.map((o) => (
                      <Chip key={o.id} on={edad === o.id} onClick={() => setEdad(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {edad === 'otro' && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos tu edad"
                      value={edadOtroTxt}
                      onChange={(e) => setEdadOtroTxt(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* STEP 3 — en que andas (tono según edad) */}
              {step === 3 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">
                    {joven ? '¿Qué onda, en qué andás?' : 'Contanos, ¿en qué andás?'}
                  </h1>
                  <div className="flex flex-wrap gap-2.5">
                    {SITUACIONES.map((o) => (
                      <Chip key={o.id} on={situacion === o.id} onClick={() => setSituacion(o.id)}>{o.emoji} {o.label}</Chip>
                    ))}
                  </div>
                  {situacion === 'otro' && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos en qué andás"
                      value={situacionOtroTxt}
                      onChange={(e) => setSituacionOtroTxt(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* STEP 4 — que queres lograr (ranking + mensajito) */}
              {step === 4 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">¿Qué querés lograr?</h1>
                  <p className="text-[14px] text-[#5b5b52]">Tocá en el orden que más te represente.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {OBJETIVOS.map((o) => {
                      const idx = rank.indexOf(o.id);
                      return (
                        <Chip key={o.id} on={idx >= 0} onClick={() => toggleRank(o.id)}>
                          {idx >= 0 && (
                            <span className="w-[19px] h-[19px] rounded-full bg-[#1E1E1E] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                          )}
                          {o.emoji} {o.label}
                        </Chip>
                      );
                    })}
                  </div>
                  {rank.includes('otro') && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos qué querés lograr"
                      value={objetivoOtroTxt}
                      onChange={(e) => setObjetivoOtroTxt(e.target.value)}
                    />
                  )}
                  <div className="flex justify-center py-1"><Face color={color ?? '#E6DCEE'} size={90} mood="happy" /></div>
                  <div className="self-center max-w-[82%] text-center bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-[#1E1E1E]">
                    {objetivoBubble}
                  </div>
                </>
              )}

              {/* STEP 5 — haces algo de esto hoy */}
              {step === 5 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">¿Hacés algo de esto hoy?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {HOY.map((o) => (
                      <Chip key={o.id} warm on={hoy.includes(o.id)} onClick={() => toggleHoy(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {hoy.includes('otro') && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos más"
                      value={hoyOtroTxt}
                      onChange={(e) => setHoyOtroTxt(e.target.value)}
                    />
                  )}
                  {vulnerable && (
                    <div
                      className="self-center max-w-[82%] text-center border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-[#1E1E1E]"
                      style={{ background: hoy.includes('abandone') ? COLORS.coralSoft : COLORS.yellowSoft }}
                    >
                      {hoy.includes('abandone') ? 'Estás en el lugar correcto.' : 'No pasa nada, todavía podés hacer mucho.'}
                    </div>
                  )}
                </>
              )}

              {/* STEP 6 — pantalla intermedia (boceto aproximado) */}
              {step === 6 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">Así se va a ir viendo tu progreso</h1>
                  <p className="text-[14px] text-[#5b5b52]">Todavía estamos definiendo esta pantalla — este es un boceto aproximado.</p>
                  <div className="relative flex-1 flex flex-col gap-2.5 bg-white border-[2.5px] border-dashed border-[#1E1E1E] rounded-[18px] p-4">
                    <span className="absolute top-2.5 right-2.5 bg-[#FCE042] border-2 border-[#1E1E1E] rounded-full px-2.5 py-0.5 text-[10.5px] font-bold">Boceto</span>
                    {[{ w: 40, c: '#2ECC71' }, { w: 65, c: '#FF6B81' }, { w: 20, c: '#FCE042' }].map((row, i) => (
                      <div key={i} className="flex items-center gap-2.5 bg-[#FFF8E7] rounded-xl px-3 py-2.5">
                        <div className="w-5 h-5 rounded-full border-2 border-[#1E1E1E] shrink-0" style={{ background: row.c }} />
                        <div className="flex-1 h-2 bg-[#eee] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.w}%`, background: row.c }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-[14px] text-[#5b5b52] mt-auto">Ya lo vamos a terminar de diseñar juntas — esto es solo para que veas la idea.</p>
                  </div>
                </>
              )}

              {/* STEP 7 — como venis con tu plata */}
              {step === 7 && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">¿Cómo venís con tu plata?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {COMO_VIENES.map((o) => (
                      <Chip key={o.id} on={comoViene === o.id} onClick={() => setComoViene(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {comoViene === 'otro' && (
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Contanos más"
                      value={comoVieneOtroTxt}
                      onChange={(e) => setComoVieneOtroTxt(e.target.value)}
                    />
                  )}
                  {comoVieneMsg && (
                    <div className="self-center max-w-[82%] text-center bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-[#1E1E1E]">
                      {comoVieneMsg}
                    </div>
                  )}
                </>
              )}

              {/* STEP 8 — empecemos / login, o confirmacion final */}
              {step === 8 && !finished && (
                <>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E]">Guardá tu progreso</h1>
                  <p className="text-[14px] text-[#5b5b52]">Todos los meses vas a poder ver cómo venís.</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#5b5b52]">Mail o teléfono</label>
                    <input
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="vos@mail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#5b5b52]">Contraseña</label>
                    <input
                      type="password"
                      className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 8 && finished && (
                <>
                  <div className="flex justify-center py-2"><Face color={color ?? '#E6DCEE'} mood="happy" /></div>
                  <h1 className="font-['Baloo_2'] text-[23px] font-bold text-[#1E1E1E] text-center">¡Llegaste a FINA! 🎉</h1>
                  <p className="text-[14px] text-[#5b5b52] text-center">Ya está — a partir de ahora, te acompañamos en esto.</p>
                </>
              )}
            </motion.div>
        </div>

        {!finished && (
          <div className="px-[22px] pt-2.5 pb-6 flex flex-col gap-1.5">
            <Cta label={ctaLabels[step]} disabled={!stepValid(step)} onClick={onNext} />
            {step === 5 && (
              <button type="button" onClick={onSkip} className="text-[13.5px] font-semibold text-[#5b5b52] underline py-2 text-center">
                Saltar por ahora
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

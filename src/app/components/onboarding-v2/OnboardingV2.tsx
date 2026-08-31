import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { COLORS, DeviceFrame, Face, CheckIcon, Chip, Cta, saveV2Categorias, saveV2InversionesPerfil, saveV2ObjetivosIniciales, saveV2Nombre } from './shared';

// REDISEÑO — Onboarding v2 (rama feat/rediseno-onboarding-v2)
//
// Sandbox aislado para iterar el onboarding sin tocar el flujo real
// (/personal-data, /activity, etc.), que sigue en producción sin cambios.
// Vive en su propia ruta pública (/onboarding-v2, ver routes.tsx) para poder
// iterarlo sin necesitar sesión ni tocar Supabase todavía — el estado es
// 100% local. Cuando el diseño se cierre, esto se porta al flujo real
// (UserData, Supabase, el resto del router).
//
// Estética v2 (segunda pasada): se dejó atrás el "rubber hose / mascota"
// (bordes negros gruesos, sombra dura de sticker, Baloo 2) por pedido
// explícito — pega más con Headspace/Cleo/Nubank: tarjetas blancas con
// sombra suave, tipografía Poppins (la misma que ya usa el resto de FINA,
// vía --font-sans), y el púrpura de marca real (#7626B3) en vez de un
// acento inventado. Preguntas antes de pedir cuenta, sin montos de plata
// en ningún paso, "Otro" siempre con campo de texto, cada respuesta con
// una devolución cálida (nunca un camino que se sienta juzgado).
//
// El flujo es DINÁMICO según lo que se eligió en "¿Qué querés lograr?":
// solo se pregunta lo que tiene que ver con eso — categorías de gasto si
// eligió ahorrar/controlar, un mini-perfil si eligió invertir, si tiene
// objetivos en mente si eligió eso — y todo es salteable: lo que no se
// contesta acá se completa después, adentro de cada sección.

type Genero = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir' | null;
type Edad = '12-17' | '18-24' | '25-34' | '35-44' | '45+' | 'otro' | null;
type Situacion = 'trabaja' | 'estudia' | 'ambas' | 'ninguna' | 'otro' | null;
type ObjetivoId = 'ahorrar' | 'invertir' | 'controlar' | 'objetivo' | 'otro';
type HoyId = 'ahorro' | 'invierto' | 'controlo' | 'nunca_supe' | 'nunca_intente' | 'abandone' | 'otro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';

type StepKey =
  | 'intro' | 'nombre' | 'color' | 'generoEdad' | 'situacion' | 'objetivo'
  | 'categoriasGasto' | 'perfilInversor' | 'metasEnMente'
  | 'hoy' | 'intermedia' | 'comoViene' | 'login';

const CTA_LABELS: Record<StepKey, string> = {
  intro: 'Empezar',
  nombre: 'Continuar',
  color: 'Continuar',
  generoEdad: 'Continuar',
  situacion: 'Continuar',
  objetivo: 'Continuar',
  categoriasGasto: 'Continuar',
  perfilInversor: 'Continuar',
  metasEnMente: 'Continuar',
  hoy: 'Continuar',
  intermedia: 'Ya lo vi, seguimos',
  comoViene: 'Continuar',
  login: 'Empezar',
};
// Pasos opcionales/de perfilado: se pueden saltar sin contestar nada.
const SKIPPABLE: StepKey[] = ['hoy', 'categoriasGasto', 'perfilInversor', 'metasEnMente'];

const FACE_DEFAULT = '#E4DDEE';
const COLOR_DOTS: { id: string; hex: string }[] = [
  { id: 'brand', hex: COLORS.brand },
  { id: 'coral', hex: COLORS.coral },
  { id: 'gold', hex: COLORS.gold },
  { id: 'sky', hex: COLORS.sky },
  { id: 'green', hex: COLORS.green },
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

const CATEGORIAS_GASTO: { id: string; label: string; emoji: string }[] = [
  { id: 'Delivery', label: 'Delivery', emoji: '🛵' },
  { id: 'Restaurantes', label: 'Restaurantes', emoji: '🍽️' },
  { id: 'Cafeterías', label: 'Cafeterías', emoji: '☕' },
  { id: 'Salidas y entretenimiento', label: 'Salidas y entretenimiento', emoji: '🎉' },
  { id: 'Supermercado', label: 'Supermercado', emoji: '🛒' },
  { id: 'Transporte', label: 'Transporte', emoji: '🚌' },
  { id: 'Belleza y cuidado personal', label: 'Belleza y cuidado personal', emoji: '💅' },
  { id: 'Ropa', label: 'Ropa', emoji: '👕' },
  { id: 'Suscripciones', label: 'Suscripciones', emoji: '📺' },
  { id: 'Compras online', label: 'Compras online', emoji: '📦' },
];

const COMO_VIENES: { id: ComoVieneId; label: string; msg: string }[] = [
  { id: 'justo', label: 'Me alcanza justo', msg: 'Genial — vamos a ayudarte a que te sobre cada vez más.' },
  { id: 'sobra', label: 'Me sobra un poco', msg: 'Buenísimo, te ayudamos a que ese sobrante trabaje para vos.' },
  { id: 'no_llega', label: 'No llego a fin de mes', msg: 'No te preocupes, vinimos justo para eso.' },
  { id: 'hago_lo_que_quiero', label: 'Hago lo que quiero', msg: 'Como a vos te gusta — te ayudamos a que te dure más.' },
  { id: 'no_lo_tengo_en_cuenta', label: 'No lo tengo muy en cuenta', msg: 'Te vamos a hacer mucho más fácil tenerlo en cuenta.' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', msg: 'Todo bien — lo vamos descubriendo juntas, a tu ritmo.' },
  { id: 'otro', label: 'Otro', msg: 'Sea lo que sea, acá vas a poder resolverlo.' },
];

const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors';

export function OnboardingV2() {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nombre, setNombre] = useState('');
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
  const [categoriasGasto, setCategoriasGasto] = useState<string[]>([]);
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>([]);
  const [categoriaOtroTxt, setCategoriaOtroTxt] = useState('');
  const [porQueInv, setPorQueInv] = useState<string | null>(null);
  const [reaccionInv, setReaccionInv] = useState<string | null>(null);
  const [tieneMetas, setTieneMetas] = useState<'si' | 'no' | null>(null);
  const [metasNombres, setMetasNombres] = useState<string[]>([]);
  const [metaTxt, setMetaTxt] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [finished, setFinished] = useState(false);

  // El flujo se arma según lo que contestó en "¿Qué querés lograr?" — cada
  // pregunta específica de un objetivo solo aparece si lo votó.
  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = ['intro', 'nombre', 'color', 'generoEdad', 'situacion', 'objetivo'];
    if (rank.includes('ahorrar') || rank.includes('controlar')) f.push('categoriasGasto');
    if (rank.includes('invertir')) f.push('perfilInversor');
    if (rank.includes('objetivo')) f.push('metasEnMente');
    f.push('hoy', 'intermedia', 'comoViene', 'login');
    return f;
  }, [rank]);
  const currentKey = flow[Math.min(currentIdx, flow.length - 1)];

  const toggleRank = (id: ObjetivoId) =>
    setRank((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleHoy = (id: HoyId) =>
    setHoy((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  const toggleCategoriaGasto = (id: string) =>
    setCategoriasGasto((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  function addCategoriaCustom() {
    const txt = categoriaOtroTxt.trim();
    if (!txt || categoriasCustom.includes(txt)) return;
    setCategoriasCustom((c) => [...c, txt]);
    setCategoriaOtroTxt('');
  }
  const removeCategoriaCustom = (txt: string) => setCategoriasCustom((c) => c.filter((x) => x !== txt));
  function addMeta() {
    const txt = metaTxt.trim();
    if (!txt || metasNombres.includes(txt)) return;
    setMetasNombres((m) => [...m, txt]);
    setMetaTxt('');
  }
  const removeMeta = (txt: string) => setMetasNombres((m) => m.filter((x) => x !== txt));

  const joven = edad === '12-17' || edad === '18-24';
  const vulnerable = HOY_VULNERABLES.some((id) => hoy.includes(id));
  const comoVieneMsg = comoViene ? COMO_VIENES.find((o) => o.id === comoViene)?.msg : null;
  const objetivoBubble = rank.length ? BUBBLE_POR_TOP[rank[0]] : 'No te vas a arrepentir...';

  function stepValid(key: StepKey): boolean {
    if (key === 'nombre') return nombre.trim().length > 0;
    if (key === 'color') return !!color;
    if (key === 'generoEdad') return !!genero && !!edad;
    if (key === 'situacion') return !!situacion;
    if (key === 'objetivo') return rank.length > 0;
    if (key === 'login') return email.trim().length > 0 && password.length >= 6;
    return true;
  }

  function onNext() {
    if (!stepValid(currentKey)) return;
    if (currentKey === 'login') {
      if (!finished) {
        // Puente hacia el post-onboarding: lo que se contestó acá ya
        // aparece armado en la sección correspondiente (sandbox local,
        // ver shared.tsx). Lo que se saltea, se completa ahí directamente.
        saveV2Nombre(nombre.trim());
        saveV2Categorias([...categoriasGasto, ...categoriasCustom]);
        if (porQueInv || reaccionInv) saveV2InversionesPerfil({ porQue: porQueInv ?? '', reaccion: reaccionInv ?? '' });
        if (metasNombres.length > 0) saveV2ObjetivosIniciales(metasNombres);
        setFinished(true);
        return;
      }
      navigate('/onboarding-v2/home');
      return;
    }
    setCurrentIdx((i) => Math.min(i + 1, flow.length - 1));
  }
  function onSkip() {
    setCurrentIdx((i) => Math.min(i + 1, flow.length - 1));
  }

  const showTop = currentIdx > 0 && currentKey !== 'login';
  const progressPct = Math.round((currentIdx / (flow.length - 1)) * 100);

  return (
    <DeviceFrame>
        {showTop && (
          <div className="px-[22px] pt-5 pb-1">
            <div className="h-[5px] rounded-full bg-[rgba(31,27,46,0.08)] overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progressPct}%`, background: COLORS.brand }} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col px-[22px] py-4 overflow-y-auto gap-4">
          <motion.div
              key={finished ? 'finished' : currentKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* INTRO — checklist premio */}
              {currentKey === 'intro' && (
                <>
                  <h1 className="text-[23px] font-bold leading-tight" style={{ color: COLORS.ink }}>
                    Llegó tu momento de cambiar la historia de tus finanzas 💪
                  </h1>
                  <div className="flex flex-col gap-3 bg-white rounded-[18px] p-[18px] shadow-[0_2px_20px_rgba(31,27,46,0.07)]">
                    {['Conocé tus gastos', 'Lográ tus objetivos', 'Cuidá tu bienestar financiero'].map((txt) => (
                      <div key={txt} className="flex items-center gap-2.5 text-[15px] font-semibold" style={{ color: COLORS.ink }}>
                        <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brand }}>
                          <CheckIcon />
                        </span>
                        {txt}
                      </div>
                    ))}
                  </div>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todo esto, a tu ritmo — no hace falta que sepas nada todavía.</p>
                </>
              )}

              {/* NOMBRE — lo primero que personaliza todo lo demás */}
              {currentKey === 'nombre' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cómo te llamamos?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Así te vamos a hablar de acá en adelante.</p>
                  <input
                    autoFocus
                    className={inputClass}
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onNext(); }}
                  />
                </>
              )}

              {/* COLOR */}
              {currentKey === 'color' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Antes que nada... elegí un color para tu perfil</h1>
                  <div className="flex justify-center py-2">
                    <Face color={color ?? FACE_DEFAULT} />
                  </div>
                  <div className="flex justify-center gap-3.5 pt-1.5">
                    {COLOR_DOTS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.hex)}
                        className="w-[34px] h-[34px] rounded-full transition-transform duration-100 active:scale-90"
                        style={{
                          background: c.hex,
                          outline: color === c.hex ? `2.5px solid ${COLORS.ink}` : undefined,
                          outlineOffset: color === c.hex ? '2.5px' : undefined,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* GENERO + EDAD */}
              {currentKey === 'generoEdad' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Con qué género te identificás?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {GENEROS.map((o) => (
                      <Chip key={o.id} on={genero === o.id} onClick={() => setGenero(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {genero === 'otro' && (
                    <input
                      className={inputClass}
                      placeholder="Contanos cómo te identificás"
                      value={generoOtroTxt}
                      onChange={(e) => setGeneroOtroTxt(e.target.value)}
                    />
                  )}
                  <h1 className="text-[23px] font-bold mt-2.5" style={{ color: COLORS.ink }}>¿Qué edad tenés?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {EDADES.map((o) => (
                      <Chip key={o.id} on={edad === o.id} onClick={() => setEdad(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {edad === 'otro' && (
                    <input
                      className={inputClass}
                      placeholder="Contanos tu edad"
                      value={edadOtroTxt}
                      onChange={(e) => setEdadOtroTxt(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* SITUACION (tono según edad) */}
              {currentKey === 'situacion' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>
                    {joven ? '¿Qué onda, en qué andás?' : 'Contanos, ¿en qué andás?'}
                  </h1>
                  <div className="flex flex-wrap gap-2.5">
                    {SITUACIONES.map((o) => (
                      <Chip key={o.id} on={situacion === o.id} onClick={() => setSituacion(o.id)}>{o.emoji} {o.label}</Chip>
                    ))}
                  </div>
                  {situacion === 'otro' && (
                    <input
                      className={inputClass}
                      placeholder="Contanos en qué andás"
                      value={situacionOtroTxt}
                      onChange={(e) => setSituacionOtroTxt(e.target.value)}
                    />
                  )}
                </>
              )}

              {/* OBJETIVO (ranking + mensajito) — define qué preguntas siguen */}
              {currentKey === 'objetivo' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Qué querés lograr?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tocá en el orden que más te represente.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {OBJETIVOS.map((o) => {
                      const idx = rank.indexOf(o.id);
                      return (
                        <Chip key={o.id} on={idx >= 0} onClick={() => toggleRank(o.id)}>
                          {idx >= 0 && (
                            <span className="w-[19px] h-[19px] rounded-full bg-white/25 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
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
                      className={inputClass}
                      placeholder="Contanos qué querés lograr"
                      value={objetivoOtroTxt}
                      onChange={(e) => setObjetivoOtroTxt(e.target.value)}
                    />
                  )}
                  <div className="flex justify-center py-1"><Face color={color ?? FACE_DEFAULT} size={90} mood="happy" /></div>
                  <div className="self-center max-w-[82%] text-center bg-white rounded-2xl px-4 py-3 text-[13.5px] font-semibold shadow-[0_2px_16px_rgba(31,27,46,0.06)]" style={{ color: COLORS.ink }}>
                    {objetivoBubble}
                  </div>
                </>
              )}

              {/* CATEGORIAS DE GASTO — solo si votó ahorrar o controlar */}
              {currentKey === 'categoriasGasto' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En qué se te suele ir la plata y te gustaría recortar?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí las que quieras — con esto ya te armamos las secciones en Gastos.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {CATEGORIAS_GASTO.map((o) => (
                      <Chip key={o.id} on={categoriasGasto.includes(o.id)} onClick={() => toggleCategoriaGasto(o.id)}>{o.emoji} {o.label}</Chip>
                    ))}
                    {categoriasCustom.map((txt) => (
                      <Chip key={txt} on onClick={() => removeCategoriaCustom(txt)}>✍️ {txt} ✕</Chip>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`flex-1 ${inputClass}`}
                      placeholder="Otro (podés agregar más de uno)"
                      value={categoriaOtroTxt}
                      onChange={(e) => setCategoriaOtroTxt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategoriaCustom(); } }}
                    />
                    <button
                      type="button"
                      onClick={addCategoriaCustom}
                      className="rounded-2xl px-4 font-bold shrink-0 transition-all duration-100 active:scale-95"
                      style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
                    >
                      + Agregar
                    </button>
                  </div>
                </>
              )}

              {/* PERFIL DE INVERSOR (mini) — solo si votó invertir */}
              {currentKey === 'perfilInversor' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Dijiste que querés invertir — dos preguntas rápidas</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Con esto ya armamos un primer perfil; el resto lo terminás en Inversiones.</p>
                  <p className="text-[15px] font-semibold mt-1" style={{ color: COLORS.ink }}>¿Por qué querés invertir?</p>
                  <div className="flex flex-wrap gap-2.5">
                    {['Para sacarla pronto', 'Para mantenerla en otro lado'].map((o) => (
                      <Chip key={o} on={porQueInv === o} onClick={() => setPorQueInv(o)}>{o}</Chip>
                    ))}
                  </div>
                  <p className="text-[15px] font-semibold mt-1" style={{ color: COLORS.ink }}>Si lo que invertiste baja 20%, ¿qué hacés?</p>
                  <div className="flex flex-wrap gap-2.5">
                    {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
                      <Chip key={o} on={reaccionInv === o} onClick={() => setReaccionInv(o)}>{o}</Chip>
                    ))}
                  </div>
                </>
              )}

              {/* METAS EN MENTE — solo si votó "lograr objetivos puntuales" */}
              {currentKey === 'metasEnMente' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Ya tenés algún objetivo en mente?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {(['si', 'no'] as const).map((o) => (
                      <Chip key={o} on={tieneMetas === o} onClick={() => setTieneMetas(o)}>{o === 'si' ? 'Sí' : 'Todavía no'}</Chip>
                    ))}
                  </div>
                  {tieneMetas === 'si' && (
                    <>
                      {metasNombres.length > 0 && (
                        <div className="flex flex-wrap gap-2.5">
                          {metasNombres.map((m) => (
                            <Chip key={m} on onClick={() => removeMeta(m)}>🎯 {m} ✕</Chip>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          className={`flex-1 ${inputClass}`}
                          placeholder="Ej: Viaje a Bariloche"
                          value={metaTxt}
                          onChange={(e) => setMetaTxt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMeta(); } }}
                        />
                        <button
                          type="button"
                          onClick={addMeta}
                          className="rounded-2xl px-4 font-bold shrink-0 transition-all duration-100 active:scale-95"
                          style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
                        >
                          + Agregar
                        </button>
                      </div>
                      {metasNombres.length > 0 && (
                        <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Ya te los dejamos armados en Objetivos para que completes los detalles.</p>
                      )}
                    </>
                  )}
                </>
              )}

              {/* HOY — haces algo de esto hoy */}
              {currentKey === 'hoy' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Hacés algo de esto hoy?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {HOY.map((o) => (
                      <Chip key={o.id} warm on={hoy.includes(o.id)} onClick={() => toggleHoy(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {hoy.includes('otro') && (
                    <input
                      className={inputClass}
                      placeholder="Contanos más"
                      value={hoyOtroTxt}
                      onChange={(e) => setHoyOtroTxt(e.target.value)}
                    />
                  )}
                  {vulnerable && (
                    <div
                      className="self-center max-w-[82%] text-center rounded-2xl px-4 py-3 text-[13.5px] font-semibold"
                      style={{ background: hoy.includes('abandone') ? COLORS.coralSoft : COLORS.goldSoft, color: COLORS.ink }}
                    >
                      {hoy.includes('abandone') ? 'Estás en el lugar correcto.' : 'No pasa nada, todavía podés hacer mucho.'}
                    </div>
                  )}
                </>
              )}

              {/* INTERMEDIA — pantalla boceto aproximado */}
              {currentKey === 'intermedia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Así se va a ir viendo tu progreso</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todavía estamos definiendo esta pantalla — este es un boceto aproximado.</p>
                  <div className="relative flex-1 flex flex-col gap-2.5 bg-white border border-dashed border-[rgba(31,27,46,0.18)] rounded-[18px] p-4">
                    <span className="absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>Boceto</span>
                    {[{ w: 40, c: COLORS.brand }, { w: 65, c: COLORS.coral }, { w: 20, c: COLORS.gold }].map((row, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: COLORS.paper }}>
                        <div className="w-5 h-5 rounded-full shrink-0" style={{ background: row.c }} />
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(31,27,46,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${row.w}%`, background: row.c }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-[14px] mt-auto" style={{ color: COLORS.inkSoft }}>Ya lo vamos a terminar de diseñar juntas — esto es solo para que veas la idea.</p>
                  </div>
                </>
              )}

              {/* COMO VIENES con tu plata */}
              {currentKey === 'comoViene' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cómo venís con tu plata?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {COMO_VIENES.map((o) => (
                      <Chip key={o.id} on={comoViene === o.id} onClick={() => setComoViene(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {comoViene === 'otro' && (
                    <input
                      className={inputClass}
                      placeholder="Contanos más"
                      value={comoVieneOtroTxt}
                      onChange={(e) => setComoVieneOtroTxt(e.target.value)}
                    />
                  )}
                  {comoVieneMsg && (
                    <div className="self-center max-w-[82%] text-center bg-white rounded-2xl px-4 py-3 text-[13.5px] font-semibold shadow-[0_2px_16px_rgba(31,27,46,0.06)]" style={{ color: COLORS.ink }}>
                      {comoVieneMsg}
                    </div>
                  )}
                </>
              )}

              {/* LOGIN — o confirmacion final */}
              {currentKey === 'login' && !finished && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Guardá tu progreso</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todos los meses vas a poder ver cómo venís.</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Mail o teléfono</label>
                    <input
                      className={inputClass}
                      placeholder="vos@mail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Contraseña</label>
                    <input
                      type="password"
                      className={inputClass}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </>
              )}

              {currentKey === 'login' && finished && (
                <>
                  <div className="flex justify-center py-2"><Face color={color ?? FACE_DEFAULT} mood="happy" /></div>
                  <h1 className="text-[23px] font-bold text-center" style={{ color: COLORS.ink }}>¡Llegaste a FINA, {nombre.trim().split(' ')[0]}! 🎉</h1>
                  <p className="text-[14px] text-center" style={{ color: COLORS.inkSoft }}>Ya está — a partir de ahora, te acompañamos en esto.</p>
                </>
              )}
            </motion.div>
        </div>

        <div className="px-[22px] pt-2.5 pb-6 flex flex-col gap-1.5">
          <Cta label={finished ? 'Ir a mi FINA' : CTA_LABELS[currentKey]} disabled={!finished && !stepValid(currentKey)} onClick={onNext} />
          {!finished && SKIPPABLE.includes(currentKey) && (
            <button type="button" onClick={onSkip} className="text-[13.5px] font-semibold underline py-2 text-center" style={{ color: COLORS.inkSoft }}>
              Saltar por ahora
            </button>
          )}
        </div>
    </DeviceFrame>
  );
}

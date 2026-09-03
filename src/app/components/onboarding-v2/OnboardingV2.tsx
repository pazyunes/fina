import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  COLORS, DeviceFrame, Face, CheckIcon, Chip, Cta, SegmentedTab,
  crearGrupoDemo, loadV2Grupo, saveV2Categorias, saveV2Grupo,
  saveV2InversionesPerfil, saveV2ObjetivosIniciales, saveV2Nombre,
  saveV2PerfilOnboarding, saveV2TerminosAceptados,
} from './shared';

// REDISEÑO — Onboarding v2 (rama dev)
//
// Sandbox aislado para iterar el onboarding sin tocar el flujo real
// (/personal-data, /activity, etc.), que sigue en producción sin cambios.
// Vive en su propia ruta pública (/onboarding-v2, ver routes.tsx) para poder
// iterarlo sin necesitar sesión ni tocar Supabase todavía — el estado es
// 100% local. Cuando el diseño se cierre, esto se porta al flujo real
// (UserData, Supabase, el resto del router).
//
// Estética: tarjetas blancas con sombra suave, Poppins, el púrpura de marca
// real (#7626B3). Preguntas antes de pedir cuenta, sin montos de plata en
// ningún paso, "Otro" siempre con campo de texto (y se GUARDA de verdad,
// nunca se descarta post-onboarding), cada respuesta con una devolución
// cálida.
//
// TONO: ninguna pregunta pide un monto ni una cifra exacta — todo se
// pregunta como quien cuenta su situación, nunca como un formulario de
// banco. Esto importa tanto como el contenido en sí.
//
// SECCIONES: el onboarding agrupa preguntas relacionadas bajo un nombre y un
// fondo de color propio (ver SECCION_DE/SECCION_INFO) — la barra de arriba
// pasa a ser un segmento por sección, y cada segmento se va llenando a
// medida que avanzás dentro de esa sección. Esto es lo que hace que un
// flujo largo (necesario para juntar buena info para el futuro asesor) no
// se sienta un formulario gigante: se percibe como capítulos, no como una
// sola lista interminable.
//
// El flujo es DINÁMICO según lo que se eligió en "¿Qué querés lograr?" y en
// las categorías de gasto: solo se pregunta lo que corresponde, y todo lo
// que no es obligatorio es salteable — lo que no se contesta acá se
// completa después, adentro de cada sección.

type Genero = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir' | null;
type Edad = '12-17' | '18-24' | '25-34' | '35-44' | '45+' | 'otro' | null;
type Situacion = 'trabaja' | 'estudia' | 'ambas' | 'ninguna' | 'otro' | null;
type ObjetivoId = 'ahorrar' | 'invertir' | 'controlar' | 'objetivo' | 'otro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';
type Moneda = 'ARS' | 'USD';

type StepKey =
  | 'intro' | 'nombre' | 'generoEdad' | 'situacion' | 'convivencia' | 'zona'
  | 'ingresos' | 'estabilidadIngresos' | 'margenPropio' | 'gastosFijos' | 'categoriasGasto' | 'categoriasRecortar'
  | 'objetivo' | 'metasEnMente' | 'horizonte' | 'monedaObjetivo'
  | 'perfilInversorPorque' | 'perfilInversorReaccion'
  | 'ahorra' | 'invierte' | 'controlaGastos' | 'comoViene'
  | 'intermedia' | 'comoConocio' | 'terminos' | 'login';

const CTA_LABELS: Record<StepKey, string> = {
  intro: 'Empezar',
  nombre: 'Continuar',
  generoEdad: 'Continuar',
  situacion: 'Continuar',
  convivencia: 'Continuar',
  zona: 'Continuar',
  ingresos: 'Continuar',
  estabilidadIngresos: 'Continuar',
  margenPropio: 'Continuar',
  gastosFijos: 'Continuar',
  categoriasGasto: 'Continuar',
  categoriasRecortar: 'Continuar',
  objetivo: 'Continuar',
  metasEnMente: 'Continuar',
  horizonte: 'Continuar',
  monedaObjetivo: 'Continuar',
  perfilInversorPorque: 'Continuar',
  perfilInversorReaccion: 'Continuar',
  ahorra: 'Continuar',
  invierte: 'Continuar',
  controlaGastos: 'Continuar',
  comoViene: 'Continuar',
  intermedia: 'Genial, sigamos',
  comoConocio: 'Continuar',
  terminos: 'Aceptar y continuar',
  login: 'Empezar',
};
// Pasos opcionales/de perfilado: se pueden saltar sin contestar nada. Lo
// obligatorio es lo mínimo para que el resto de la app funcione (nombre,
// género/edad, situación, objetivo, términos, login).
const SKIPPABLE: StepKey[] = [
  'convivencia', 'zona', 'ingresos', 'estabilidadIngresos', 'margenPropio', 'gastosFijos',
  'categoriasGasto', 'categoriasRecortar', 'metasEnMente', 'horizonte', 'monedaObjetivo',
  'perfilInversorPorque', 'perfilInversorReaccion', 'ahorra', 'invierte', 'controlaGastos', 'comoConocio',
];

// ── Secciones: nombre + fondo propio por bloque de preguntas ───────────
type SeccionId = 'bienvenida' | 'vos' | 'diaadia' | 'objetivos' | 'invertir' | 'habitos' | 'cierre';
const SECCION_INFO: Record<SeccionId, { label: string; bg: string }> = {
  bienvenida: { label: '', bg: COLORS.paper },
  vos: { label: 'Vos', bg: COLORS.tint },
  diaadia: { label: 'Tu día a día', bg: COLORS.goldSoft },
  objetivos: { label: 'Objetivos', bg: COLORS.coralSoft },
  invertir: { label: 'Cómo invertís', bg: COLORS.skySoft },
  habitos: { label: 'Tus hábitos', bg: COLORS.greenSoft },
  cierre: { label: 'Ya casi', bg: COLORS.brandSoft },
};
const SECCION_DE: Record<StepKey, SeccionId> = {
  intro: 'bienvenida', nombre: 'bienvenida',
  generoEdad: 'vos', situacion: 'vos', convivencia: 'vos', zona: 'vos',
  ingresos: 'diaadia', estabilidadIngresos: 'diaadia', margenPropio: 'diaadia',
  gastosFijos: 'diaadia', categoriasGasto: 'diaadia', categoriasRecortar: 'diaadia',
  objetivo: 'objetivos', metasEnMente: 'objetivos', horizonte: 'objetivos', monedaObjetivo: 'objetivos',
  perfilInversorPorque: 'invertir', perfilInversorReaccion: 'invertir',
  ahorra: 'habitos', invierte: 'habitos', controlaGastos: 'habitos', comoViene: 'habitos',
  intermedia: 'cierre', comoConocio: 'cierre', terminos: 'cierre',
  login: 'cierre',
};

const FACE_COLOR = COLORS.brand; // ya no se elige color de perfil — todas las cuentas arrancan igual

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

const CONVIVENCIA_OPCIONES = ['Vivo sola/o', 'Con mi pareja', 'Con mi familia', 'Con roommates', 'Tengo hijos/as a cargo', 'Tengo otras personas a cargo'];

const ZONAS: { id: string; label: string }[] = [
  { id: 'CABA', label: 'CABA' },
  { id: 'GBA', label: 'GBA' },
  { id: 'Otra provincia', label: 'Otra provincia' },
  { id: 'Fuera de Argentina', label: 'Fuera de Argentina' },
  { id: 'Prefiero no decir', label: 'Prefiero no decir' },
];

const INGRESOS_OPCIONES = ['Sueldo fijo', 'Changas o freelance', 'Mi propio emprendimiento', 'Beca', 'Mis papás/familia me bancan', 'Por ahora casi no manejo plata propia'];

const ESTABILIDAD: { id: string; label: string }[] = [
  { id: 'Todos los meses, más o menos lo mismo', label: 'Todos los meses, más o menos lo mismo' },
  { id: 'Todos los meses, pero varía bastante', label: 'Todos los meses, pero varía bastante' },
  { id: 'Depende de cuándo sale trabajo', label: 'Depende de cuándo sale trabajo' },
  { id: 'Todavía no es algo regular', label: 'Todavía no es algo regular' },
  { id: 'otro', label: 'Otro' },
];

const MARGEN: { id: string; label: string }[] = [
  { id: 'Toda es mía, la uso como quiero', label: 'Toda es mía, la uso como quiero' },
  { id: 'Una parte es mía, el resto se va en gastos fijos', label: 'Una parte es mía, el resto se va en gastos fijos' },
  { id: 'Casi toda se va en gastos fijos o de otros', label: 'Casi toda se va en gastos fijos o de otros' },
  { id: 'Me la dan para algo puntual', label: 'Me la dan para algo puntual' },
  { id: 'Todavía no lo pensé', label: 'Todavía no lo pensé' },
];

const GASTOS_FIJOS_OPCIONES = ['Alquiler', 'Cuota de préstamo', 'Tarjeta de crédito', 'Obra social o prepaga', 'Suscripciones', 'Cuota de estudios', 'Ayuda a familiares', 'Ninguno por ahora'];

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

const METAS_SUGERIDAS = ['Viaje', 'Un regalo para alguien', 'Pagar una deuda', 'Comprarme algo especial', 'Fondo para imprevistos', 'Mudarme / depto propio', 'Estudios o un curso', 'Auto o moto', 'Un evento grande', 'Un emprendimiento'];

const HORIZONTES: { id: string; label: string }[] = [
  { id: 'En los próximos meses', label: 'En los próximos meses' },
  { id: 'Este año', label: 'Este año' },
  { id: 'El año que viene', label: 'El año que viene' },
  { id: 'En 2 a 5 años', label: 'En 2 a 5 años' },
  { id: 'Más de 5 años', label: 'Más de 5 años' },
  { id: 'fecha_exacta', label: 'Tengo una fecha exacta en mente' },
  { id: 'Todavía no lo pensé', label: 'Todavía no lo pensé' },
];

const AHORRA: { id: string; label: string }[] = [
  { id: 'Sí', label: 'Sí' },
  { id: 'Más o menos', label: 'Más o menos' },
  { id: 'Nunca supe cómo empezar', label: 'Nunca supe cómo empezar' },
  { id: 'Empecé y no lo pude sostener', label: 'Empecé y no lo pude sostener' },
  { id: 'otro', label: 'Otro' },
];

const INVIERTE: { id: string; label: string }[] = [
  { id: 'Sí, y lo manejo yo', label: 'Sí, y lo manejo yo' },
  { id: 'Sí, pero me lo maneja otra persona', label: 'Sí, pero me lo maneja otra persona' },
  { id: 'Nunca supe cómo empezar', label: 'Nunca supe cómo empezar' },
  { id: 'Empecé y no lo pude sostener', label: 'Empecé y no lo pude sostener' },
  { id: 'No me interesa por ahora', label: 'No me interesa por ahora' },
  { id: 'otro', label: 'Otro' },
];

const CONTROLA: { id: string; label: string }[] = [
  { id: 'Sí', label: 'Sí' },
  { id: 'Más o menos', label: 'Más o menos' },
  { id: 'Nunca supe cómo empezar', label: 'Nunca supe cómo empezar' },
  { id: 'Empecé y no lo pude sostener', label: 'Empecé y no lo pude sostener' },
  { id: 'otro', label: 'Otro' },
];

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

const COMO_CONOCIO: { id: string; label: string }[] = [
  { id: 'Instagram', label: 'Instagram' },
  { id: 'TikTok', label: 'TikTok' },
  { id: 'Recomendación de una amiga', label: 'Recomendación de una amiga' },
  { id: 'Buscando en Google', label: 'Buscando en Google' },
  { id: 'Una charla o evento', label: 'Una charla o evento' },
  { id: 'otro', label: 'Otro' },
];

const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors';

// Chip multi-select + input "Otro" que permite agregar más de uno — mismo
// patrón que ya existía para categorías de gasto, generalizado para que lo
// puedan usar todas las preguntas nuevas que lo necesitan.
function MultiConAgregar({
  base, seleccion, toggle, custom, agregarCustom, quitarCustom, otroTxt, setOtroTxt, placeholder,
}: {
  base: string[];
  seleccion: string[];
  toggle: (v: string) => void;
  custom: string[];
  agregarCustom: () => void;
  quitarCustom: (v: string) => void;
  otroTxt: string;
  setOtroTxt: (v: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {base.map((o) => (
          <Chip key={o} on={seleccion.includes(o)} onClick={() => toggle(o)}>{o}</Chip>
        ))}
        {custom.map((txt) => (
          <Chip key={txt} on onClick={() => quitarCustom(txt)}>✍️ {txt} ✕</Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={`flex-1 ${inputClass}`}
          placeholder={placeholder}
          value={otroTxt}
          onChange={(e) => setOtroTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCustom(); } }}
        />
        <button
          type="button"
          onClick={agregarCustom}
          className="rounded-2xl px-4 font-bold shrink-0 transition-all duration-100 active:scale-95"
          style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}
        >
          + Agregar
        </button>
      </div>
    </>
  );
}

export function OnboardingV2() {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nombre, setNombre] = useState('');
  const [genero, setGenero] = useState<Genero>(null);
  const [generoOtroTxt, setGeneroOtroTxt] = useState('');
  const [edad, setEdad] = useState<Edad>(null);
  const [edadOtroTxt, setEdadOtroTxt] = useState('');
  const [situacion, setSituacion] = useState<Situacion>(null);
  const [situacionOtroTxt, setSituacionOtroTxt] = useState('');

  const [convivencia, setConvivencia] = useState<string[]>([]);
  const [convivenciaCustom, setConvivenciaCustom] = useState<string[]>([]);
  const [convivenciaOtroTxt, setConvivenciaOtroTxt] = useState('');
  const [zona, setZona] = useState<string | null>(null);

  const [ingresos, setIngresos] = useState<string[]>([]);
  const [ingresosCustom, setIngresosCustom] = useState<string[]>([]);
  const [ingresoOtroTxt, setIngresoOtroTxt] = useState('');
  const [estabilidadIngresos, setEstabilidadIngresos] = useState<string | null>(null);
  const [estabilidadOtroTxt, setEstabilidadOtroTxt] = useState('');
  const [margenPropio, setMargenPropio] = useState<string | null>(null);

  const [gastosFijos, setGastosFijos] = useState<string[]>([]);
  const [gastosFijosCustom, setGastosFijosCustom] = useState<string[]>([]);
  const [gastoFijoOtroTxt, setGastoFijoOtroTxt] = useState('');

  const [categoriasGasto, setCategoriasGasto] = useState<string[]>([]);
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>([]);
  const [categoriaOtroTxt, setCategoriaOtroTxt] = useState('');
  const [categoriasRecortarSel, setCategoriasRecortarSel] = useState<string[]>([]);
  const [recortarNinguna, setRecortarNinguna] = useState(false);

  const [rank, setRank] = useState<ObjetivoId[]>([]);
  const [objetivoOtroTxt, setObjetivoOtroTxt] = useState('');
  const [tieneMetas, setTieneMetas] = useState<'si' | 'no' | null>(null);
  const [metasNombres, setMetasNombres] = useState<string[]>([]);
  const [metaTxt, setMetaTxt] = useState('');
  const [tipoMetas, setTipoMetas] = useState<'individual' | 'grupal'>('individual');
  const [nombreGrupoOnb, setNombreGrupoOnb] = useState('');
  const [horizonte, setHorizonte] = useState<string | null>(null);
  const [horizonteFechaTxt, setHorizonteFechaTxt] = useState('');
  const [monedaObjetivo, setMonedaObjetivo] = useState<Moneda>('ARS');

  const [porQueInv, setPorQueInv] = useState<string | null>(null);
  const [reaccionInv, setReaccionInv] = useState<string | null>(null);

  const [ahorra, setAhorra] = useState<string | null>(null);
  const [ahorraOtroTxt, setAhorraOtroTxt] = useState('');
  const [invierte, setInvierte] = useState<string | null>(null);
  const [invierteOtroTxt, setInvierteOtroTxt] = useState('');
  const [controlaGastos, setControlaGastos] = useState<string | null>(null);
  const [controlaOtroTxt, setControlaOtroTxt] = useState('');

  const [comoViene, setComoViene] = useState<ComoVieneId | null>(null);
  const [comoVieneOtroTxt, setComoVieneOtroTxt] = useState('');
  const [comoConocio, setComoConocio] = useState<string | null>(null);
  const [comoConocioOtroTxt, setComoConocioOtroTxt] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [finished, setFinished] = useState(false);

  // El flujo se arma según lo que se va contestando — cada pregunta
  // específica de un objetivo solo aparece si corresponde, y todo es una
  // pregunta por pantalla (nada de apilar varias en un mismo paso).
  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = [
      'intro', 'nombre', 'generoEdad', 'situacion', 'convivencia', 'zona',
      'ingresos', 'estabilidadIngresos', 'margenPropio', 'gastosFijos', 'categoriasGasto',
    ];
    if (categoriasGasto.length > 0 || categoriasCustom.length > 0) f.push('categoriasRecortar');
    f.push('objetivo');
    if (rank.includes('objetivo')) f.push('metasEnMente', 'horizonte', 'monedaObjetivo');
    if (rank.includes('invertir')) f.push('perfilInversorPorque', 'perfilInversorReaccion');
    f.push('ahorra', 'invierte', 'controlaGastos', 'comoViene', 'intermedia', 'comoConocio', 'terminos', 'login');
    return f;
  }, [rank, categoriasGasto, categoriasCustom]);
  const currentKey = flow[Math.min(currentIdx, flow.length - 1)];
  const seccionActual = SECCION_INFO[SECCION_DE[currentKey]];

  const toggleRank = (id: ObjetivoId) =>
    setRank((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleMulti = (setter: (fn: (v: string[]) => string[]) => void) => (id: string) =>
    setter((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const toggleConvivencia = toggleMulti(setConvivencia);
  const toggleIngresos = toggleMulti(setIngresos);
  const toggleGastosFijos = toggleMulti(setGastosFijos);
  const toggleCategoriaGasto = toggleMulti(setCategoriasGasto);
  const toggleCategoriaRecortar = (id: string) => {
    setRecortarNinguna(false);
    setCategoriasRecortarSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  };

  function agregarA(setterCustom: (fn: (v: string[]) => string[]) => void, txt: string, existentes: string[]) {
    const t = txt.trim();
    if (!t || existentes.includes(t)) return;
    setterCustom((c) => [...c, t]);
  }
  function addConvivenciaCustom() { agregarA(setConvivenciaCustom, convivenciaOtroTxt, convivenciaCustom); setConvivenciaOtroTxt(''); }
  function addIngresoCustom() { agregarA(setIngresosCustom, ingresoOtroTxt, ingresosCustom); setIngresoOtroTxt(''); }
  function addGastoFijoCustom() { agregarA(setGastosFijosCustom, gastoFijoOtroTxt, gastosFijosCustom); setGastoFijoOtroTxt(''); }
  function addCategoriaCustom() { agregarA(setCategoriasCustom, categoriaOtroTxt, categoriasCustom); setCategoriaOtroTxt(''); }
  const removeFrom = (setter: (fn: (v: string[]) => string[]) => void) => (txt: string) => setter((c) => c.filter((x) => x !== txt));

  function addMeta() {
    const txt = metaTxt.trim();
    if (!txt || metasNombres.includes(txt)) return;
    setMetasNombres((m) => [...m, txt]);
    setMetaTxt('');
  }
  const removeMeta = (txt: string) => setMetasNombres((m) => m.filter((x) => x !== txt));
  const agregarMetaSugerida = (txt: string) => {
    if (!metasNombres.includes(txt)) setMetasNombres((m) => [...m, txt]);
  };

  const joven = edad === '12-17' || edad === '18-24';
  const comoVieneMsg = comoViene ? COMO_VIENES.find((o) => o.id === comoViene)?.msg : null;
  const objetivoBubble = rank.length ? BUBBLE_POR_TOP[rank[0]] : 'No te vas a arrepentir...';
  const categoriasElegidas = [...categoriasGasto, ...categoriasCustom];

  function stepValid(key: StepKey): boolean {
    if (key === 'nombre') return nombre.trim().length > 0;
    if (key === 'generoEdad') return !!genero && !!edad;
    if (key === 'situacion') return !!situacion;
    if (key === 'objetivo') return rank.length > 0;
    if (key === 'terminos') return aceptoTerminos;
    if (key === 'login') return email.trim().length > 0 && password.length >= 6;
    return true;
  }

  // Resuelve "otro" al texto libre que escribió (así no se pierde post
  // onboarding — antes quedaba guardado como el string "otro" a secas).
  function resuelto(valor: string | null, txt: string): string | null {
    if (valor === 'otro') return txt.trim() || null;
    return valor;
  }

  function onNext() {
    if (!stepValid(currentKey)) return;
    if (currentKey === 'login') {
      if (!finished) {
        // Puente hacia el post-onboarding: lo que se contestó acá ya
        // aparece armado en la sección correspondiente (sandbox local,
        // ver shared.tsx). Lo que se saltea, se completa ahí directamente.
        saveV2Nombre(nombre.trim());
        saveV2Categorias(categoriasElegidas);

        const yaInvierteResuelto = invierte ? (invierte.startsWith('Sí') ? 'si' as const : 'no' as const) : undefined;
        if (porQueInv || reaccionInv || yaInvierteResuelto) {
          saveV2InversionesPerfil({ porQue: porQueInv ?? '', reaccion: reaccionInv ?? '', ...(yaInvierteResuelto ? { yaInvierte: yaInvierteResuelto } : {}) });
        }

        if (metasNombres.length > 0) {
          const horizonteResuelto = horizonte === 'fecha_exacta' ? (horizonteFechaTxt.trim() || null) : horizonte;
          saveV2ObjetivosIniciales(metasNombres.map((n) => ({ nombre: n, horizonte: horizonteResuelto, moneda: monedaObjetivo })));
        }
        if (tipoMetas === 'grupal' && nombreGrupoOnb.trim() && !loadV2Grupo()) {
          saveV2Grupo(crearGrupoDemo(nombreGrupoOnb.trim()));
        }

        saveV2PerfilOnboarding({
          zona,
          convivencia: [...convivencia, ...convivenciaCustom],
          ingresos: [...ingresos, ...ingresosCustom],
          estabilidadIngresos: resuelto(estabilidadIngresos, estabilidadOtroTxt),
          margenPropio,
          gastosFijos: [...gastosFijos, ...gastosFijosCustom],
          categoriasRecortar: recortarNinguna ? [] : categoriasRecortarSel,
          ahorra: resuelto(ahorra, ahorraOtroTxt),
          invierte: resuelto(invierte, invierteOtroTxt),
          controlaGastos: resuelto(controlaGastos, controlaOtroTxt),
          comoConocio: resuelto(comoConocio, comoConocioOtroTxt),
        });
        saveV2TerminosAceptados(aceptoTerminos);

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
  function onBack() {
    setCurrentIdx((i) => Math.max(i - 1, 0));
  }

  const showTop = currentIdx > 0 && currentKey !== 'login';

  // Barra segmentada: un segmento por SECCIÓN presente en el flujo (no por
  // pregunta) — así se ve "voy por la mitad de Objetivos", no un porcentaje
  // genérico de 24 pasos sueltos.
  const segmentos = useMemo(() => {
    const vistos = new Set<SeccionId>();
    const lista: SeccionId[] = [];
    flow.forEach((k) => {
      const s = SECCION_DE[k];
      if (!vistos.has(s)) { vistos.add(s); lista.push(s); }
    });
    return lista;
  }, [flow]);
  function fillDeSeccion(s: SeccionId): number {
    const idxs = flow.map((k, i) => ({ k, i })).filter((x) => SECCION_DE[x.k] === s).map((x) => x.i);
    if (idxs.length === 0) return 0;
    const alcanzados = idxs.filter((i) => i <= currentIdx).length;
    return Math.round((alcanzados / idxs.length) * 100);
  }

  return (
    <DeviceFrame>
      <div className="flex-1 flex flex-col transition-colors duration-300" style={{ background: seccionActual.bg }}>
        {showTop && (
          <div className="px-[22px] pt-5 pb-1 flex items-center gap-3">
            {currentIdx > 0 && (
              <button type="button" onClick={onBack} aria-label="Volver a la pregunta anterior" className="shrink-0 text-[15px] font-bold" style={{ color: COLORS.inkSoft }}>
                ←
              </button>
            )}
            <div className="flex-1 flex flex-col gap-1">
              {seccionActual.label && (
                <p className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>{seccionActual.label}</p>
              )}
              <div className="flex gap-1">
                {segmentos.map((s) => (
                  <div key={s} className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(31,27,46,0.1)' }}>
                    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fillDeSeccion(s)}%`, background: COLORS.brand }} />
                  </div>
                ))}
              </div>
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

              {/* NOMBRE */}
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
                    <input className={inputClass} placeholder="Contanos cómo te identificás" value={generoOtroTxt} onChange={(e) => setGeneroOtroTxt(e.target.value)} />
                  )}
                  <h1 className="text-[23px] font-bold mt-2.5" style={{ color: COLORS.ink }}>¿Qué edad tenés?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {EDADES.map((o) => (
                      <Chip key={o.id} on={edad === o.id} onClick={() => setEdad(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {edad === 'otro' && (
                    <input className={inputClass} placeholder="Contanos tu edad" value={edadOtroTxt} onChange={(e) => setEdadOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* SITUACION */}
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
                    <input className={inputClass} placeholder="Contanos en qué andás" value={situacionOtroTxt} onChange={(e) => setSituacionOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* CONVIVENCIA */}
              {currentKey === 'convivencia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Contanos un poco de tu día a día: ¿con quién compartís tu casa?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí todas las que apliquen.</p>
                  <MultiConAgregar
                    base={CONVIVENCIA_OPCIONES} seleccion={convivencia} toggle={toggleConvivencia}
                    custom={convivenciaCustom} agregarCustom={addConvivenciaCustom} quitarCustom={removeFrom(setConvivenciaCustom)}
                    otroTxt={convivenciaOtroTxt} setOtroTxt={setConvivenciaOtroTxt} placeholder="Otro (podés agregar más de uno)"
                  />
                </>
              )}

              {/* ZONA */}
              {currentKey === 'zona' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Por dónde andás viviendo?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {ZONAS.map((o) => (
                      <Chip key={o.id} on={zona === o.id} onClick={() => setZona(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </>
              )}

              {/* INGRESOS */}
              {currentKey === 'ingresos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cómo entra la plata en tu vida hoy?</h1>
                  <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>🔒 Esto es solo tuyo — nadie más lo ve. Elegí todas las que apliquen.</p>
                  <MultiConAgregar
                    base={INGRESOS_OPCIONES} seleccion={ingresos} toggle={toggleIngresos}
                    custom={ingresosCustom} agregarCustom={addIngresoCustom} quitarCustom={removeFrom(setIngresosCustom)}
                    otroTxt={ingresoOtroTxt} setOtroTxt={setIngresoOtroTxt} placeholder="Otro (podés agregar más de uno)"
                  />
                </>
              )}

              {/* ESTABILIDAD DE INGRESOS */}
              {currentKey === 'estabilidadIngresos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Y te llega siempre parecido, o varía?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {ESTABILIDAD.map((o) => (
                      <Chip key={o.id} on={estabilidadIngresos === o.id} onClick={() => setEstabilidadIngresos(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {estabilidadIngresos === 'otro' && (
                    <input className={inputClass} placeholder="Contanos más" value={estabilidadOtroTxt} onChange={(e) => setEstabilidadOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* MARGEN PROPIO */}
              {currentKey === 'margenPropio' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto de esa plata es tuya, para usar como quieras?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {MARGEN.map((o) => (
                      <Chip key={o.id} on={margenPropio === o.id} onClick={() => setMargenPropio(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </>
              )}

              {/* GASTOS FIJOS */}
              {currentKey === 'gastosFijos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Tenés algún gasto grande que se te repite todos los meses?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>No hace falta el monto, solo si existe.</p>
                  <MultiConAgregar
                    base={GASTOS_FIJOS_OPCIONES} seleccion={gastosFijos} toggle={toggleGastosFijos}
                    custom={gastosFijosCustom} agregarCustom={addGastoFijoCustom} quitarCustom={removeFrom(setGastosFijosCustom)}
                    otroTxt={gastoFijoOtroTxt} setOtroTxt={setGastoFijoOtroTxt} placeholder="Otro (podés agregar más de uno)"
                  />
                </>
              )}

              {/* CATEGORIAS DE GASTO — siempre se pregunta, no solo si votó ahorrar/controlar */}
              {currentKey === 'categoriasGasto' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En qué se te suele ir la plata día a día?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí las que quieras — con esto ya te armamos las secciones en Gastos.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {CATEGORIAS_GASTO.map((o) => (
                      <Chip key={o.id} on={categoriasGasto.includes(o.id)} onClick={() => toggleCategoriaGasto(o.id)}>{o.emoji} {o.label}</Chip>
                    ))}
                    {categoriasCustom.map((txt) => (
                      <Chip key={txt} on onClick={() => removeFrom(setCategoriasCustom)(txt)}>✍️ {txt} ✕</Chip>
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
                    <button type="button" onClick={addCategoriaCustom} className="rounded-2xl px-4 font-bold shrink-0 transition-all duration-100 active:scale-95" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                      + Agregar
                    </button>
                  </div>
                </>
              )}

              {/* CATEGORIAS A RECORTAR */}
              {currentKey === 'categoriasRecortar' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Hay alguna de estas en la que te gustaría gastar menos?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Así te avisamos si te conviene ponerle un tope.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {categoriasElegidas.map((c) => (
                      <Chip key={c} on={categoriasRecortarSel.includes(c)} onClick={() => toggleCategoriaRecortar(c)}>{c}</Chip>
                    ))}
                    <Chip on={recortarNinguna} onClick={() => { setRecortarNinguna(true); setCategoriasRecortarSel([]); }}>Ninguna por ahora</Chip>
                  </div>
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
                    <input className={inputClass} placeholder="Contanos qué querés lograr" value={objetivoOtroTxt} onChange={(e) => setObjetivoOtroTxt(e.target.value)} />
                  )}
                  <div className="flex justify-center py-1"><Face color={FACE_COLOR} size={90} mood="happy" /></div>
                  <div className="self-center max-w-[82%] text-center bg-white rounded-2xl px-4 py-3 text-[13.5px] font-semibold shadow-[0_2px_16px_rgba(31,27,46,0.06)]" style={{ color: COLORS.ink }}>
                    {objetivoBubble}
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
                      <p className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Algunas ideas para arrancar rápido:</p>
                      <div className="flex flex-wrap gap-2.5">
                        {METAS_SUGERIDAS.map((m) => (
                          <Chip key={m} on={metasNombres.includes(m)} onClick={() => (metasNombres.includes(m) ? removeMeta(m) : agregarMetaSugerida(m))}>{m}</Chip>
                        ))}
                      </div>
                      {metasNombres.length > 0 && (
                        <div className="flex flex-wrap gap-2.5">
                          {metasNombres.filter((m) => !METAS_SUGERIDAS.includes(m)).map((m) => (
                            <Chip key={m} on onClick={() => removeMeta(m)}>🎯 {m} ✕</Chip>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          className={`flex-1 ${inputClass}`}
                          placeholder="Otro (ej: Viaje a Bariloche)"
                          value={metaTxt}
                          onChange={(e) => setMetaTxt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMeta(); } }}
                        />
                        <button type="button" onClick={addMeta} className="rounded-2xl px-4 font-bold shrink-0 transition-all duration-100 active:scale-95" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                          + Agregar
                        </button>
                      </div>
                      {metasNombres.length > 0 && (
                        <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Ya te los dejamos armados en Objetivos para que completes los detalles.</p>
                      )}
                    </>
                  )}

                  <p className="text-[15px] font-semibold mt-2" style={{ color: COLORS.ink }}>¿Los vas a armar sola o con amigas?</p>
                  <SegmentedTab
                    options={[
                      { id: 'individual', label: 'Sola' },
                      { id: 'grupal', label: 'Con amigas' },
                    ]}
                    value={tipoMetas}
                    onChange={setTipoMetas}
                    trackColor={COLORS.goldSoft}
                  />
                  {tipoMetas === 'grupal' && (
                    <>
                      <input className={inputClass} placeholder="Nombre del grupo (ej: Ahorrando juntas)" value={nombreGrupoOnb} onChange={(e) => setNombreGrupoOnb(e.target.value)} />
                      <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Lo armamos ya mismo — vas a poder invitar amigas desde adentro de la app.</p>
                    </>
                  )}
                </>
              )}

              {/* HORIZONTE */}
              {currentKey === 'horizonte' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Para cuándo te gustaría lograrlo?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {HORIZONTES.map((o) => (
                      <Chip key={o.id} on={horizonte === o.id} onClick={() => setHorizonte(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {horizonte === 'fecha_exacta' && (
                    <input className={inputClass} placeholder="Ej: diciembre 2026" value={horizonteFechaTxt} onChange={(e) => setHorizonteFechaTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* MONEDA DEL OBJETIVO */}
              {currentKey === 'monedaObjetivo' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En qué moneda pensás ese objetivo?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <Chip on={monedaObjetivo === 'ARS'} onClick={() => setMonedaObjetivo('ARS')}>Pesos</Chip>
                    <Chip on={monedaObjetivo === 'USD'} onClick={() => setMonedaObjetivo('USD')}>Dólares</Chip>
                  </div>
                </>
              )}

              {/* PERFIL DE INVERSOR — 1 de 2: horizonte de la inversión */}
              {currentKey === 'perfilInversorPorque' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Con qué objetivo querés invertir esa plata?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Con esto ya armamos un primer perfil; el resto lo terminás en Inversiones.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {['Sacarla pronto (corto plazo)', 'Dejarla que rinda (largo plazo)'].map((o) => (
                      <Chip key={o} on={porQueInv === o} onClick={() => setPorQueInv(o)}>{o}</Chip>
                    ))}
                  </div>
                </>
              )}

              {/* PERFIL DE INVERSOR — 2 de 2: reacción con escenario concreto */}
              {currentKey === 'perfilInversorReaccion' && (
                <>
                  <h1 className="text-[23px] font-bold leading-snug" style={{ color: COLORS.ink }}>
                    Estás en una inversión que sube y baja en el camino, pero promete crecer a 5 años a una tasa razonable. ¿Qué hacés?
                  </h1>
                  <div className="flex flex-wrap gap-2.5">
                    {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
                      <Chip key={o} on={reaccionInv === o} onClick={() => setReaccionInv(o)}>{o}</Chip>
                    ))}
                  </div>
                </>
              )}

              {/* AHORRÁS */}
              {currentKey === 'ahorra' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Ahorrás?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {AHORRA.map((o) => (
                      <Chip key={o.id} warm on={ahorra === o.id} onClick={() => setAhorra(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {ahorra === 'otro' && (
                    <input className={inputClass} placeholder="Contanos más" value={ahorraOtroTxt} onChange={(e) => setAhorraOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* INVERTÍS */}
              {currentKey === 'invierte' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Invertís?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {INVIERTE.map((o) => (
                      <Chip key={o.id} warm on={invierte === o.id} onClick={() => setInvierte(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {invierte === 'otro' && (
                    <input className={inputClass} placeholder="Contanos más" value={invierteOtroTxt} onChange={(e) => setInvierteOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* CONTROLÁS TUS GASTOS */}
              {currentKey === 'controlaGastos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Controlás tus gastos?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {CONTROLA.map((o) => (
                      <Chip key={o.id} warm on={controlaGastos === o.id} onClick={() => setControlaGastos(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {controlaGastos === 'otro' && (
                    <input className={inputClass} placeholder="Contanos más" value={controlaOtroTxt} onChange={(e) => setControlaOtroTxt(e.target.value)} />
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
                    <input className={inputClass} placeholder="Contanos más" value={comoVieneOtroTxt} onChange={(e) => setComoVieneOtroTxt(e.target.value)} />
                  )}
                  {comoVieneMsg && (
                    <div className="self-center max-w-[82%] text-center bg-white rounded-2xl px-4 py-3 text-[13.5px] font-semibold shadow-[0_2px_16px_rgba(31,27,46,0.06)]" style={{ color: COLORS.ink }}>
                      {comoVieneMsg}
                    </div>
                  )}
                </>
              )}

              {/* COMO CONOCIO FINA */}
              {currentKey === 'comoConocio' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Una última curiosidad: ¿cómo conociste FINA?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {COMO_CONOCIO.map((o) => (
                      <Chip key={o.id} on={comoConocio === o.id} onClick={() => setComoConocio(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                  {comoConocio === 'otro' && (
                    <input className={inputClass} placeholder="Contanos más" value={comoConocioOtroTxt} onChange={(e) => setComoConocioOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {/* TERMINOS Y CONDICIONES */}
              {currentKey === 'terminos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Antes de seguir</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tus datos son privados — solo se usan para darte recomendaciones a vos. Nunca los compartimos ni los vendemos.</p>
                  <button
                    type="button"
                    onClick={() => setAceptoTerminos((v) => !v)}
                    className="flex items-center gap-3 text-left bg-white rounded-2xl p-4 shadow-[0_2px_16px_rgba(31,27,46,0.06)] transition-all duration-100 active:scale-[0.99]"
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: aceptoTerminos ? COLORS.brand : 'transparent', border: aceptoTerminos ? 'none' : '2px solid rgba(31,27,46,0.25)' }}
                    >
                      {aceptoTerminos && <CheckIcon />}
                    </span>
                    <span className="text-[13.5px] font-medium" style={{ color: COLORS.ink }}>
                      Acepto los <span className="underline font-semibold">términos y condiciones</span> y la <span className="underline font-semibold">política de privacidad</span>.
                    </span>
                  </button>
                </>
              )}

              {/* LOGIN — o confirmacion final */}
              {currentKey === 'login' && !finished && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Guardá tu progreso</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todos los meses vas a poder ver cómo venís.</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Mail o teléfono</label>
                    <input className={inputClass} placeholder="vos@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Contraseña</label>
                    <input type="password" className={inputClass} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </>
              )}

              {currentKey === 'login' && finished && (
                <>
                  <div className="flex justify-center py-2"><Face color={FACE_COLOR} mood="happy" /></div>
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
      </div>
    </DeviceFrame>
  );
}

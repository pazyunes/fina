import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  COLORS, DeviceFrame, Face, CheckIcon, Chip, Cta,
  saveV2Categorias, saveV2Nombre,
  saveV2PerfilOnboarding, saveV2TerminosAceptados,
} from './shared';

// REDISEÑO — Onboarding v2 (rama dev)
//
// Sandbox aislado para iterar el onboarding sin tocar el flujo real
// (/personal-data, /activity, etc.), que sigue en producción sin cambios.
// El estado es 100% local (localStorage) — no hay backend todavía.
//
// TONO: ninguna pregunta pide un monto ni una cifra exacta — todo se
// pregunta como quien cuenta su situación, nunca como un formulario de
// banco. "Otro" siempre está como una opción más (un chip), nunca oculto,
// y lo que se escribe ahí se GUARDA de verdad — no se pierde post-onboarding.
//
// SECCIONES: el onboarding agrupa preguntas relacionadas bajo un nombre y un
// fondo de color propio — la barra de arriba es un segmento por sección, y
// cada segmento se va llenando a medida que avanzás dentro de esa sección.
//
// Las preguntas específicas de cada área (objetivos concretos + su plazo y
// moneda, el perfil de inversión) NO se preguntan acá — el onboarding solo
// junta lo general; el resto se completa dentro de Objetivos/Inversiones
// cuando la persona entra por primera vez a esa sección.

type Genero = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir' | null;
type Edad = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | null;
type Situacion = 'trabaja' | 'estudia' | 'ambas' | 'ninguna' | null;
type ObjetivoId = 'ahorrar' | 'invertir' | 'controlar' | 'objetivo' | 'otro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';
type Nivel = 'nada' | 'poco' | 'bastante' | 'todo';
type PasoLogin = 'datos' | 'verificar';

type StepKey =
  | 'intro' | 'nombre' | 'generoEdad' | 'objetivo' | 'situacion' | 'convivencia' | 'zona'
  | 'ingresos' | 'estabilidadIngresos' | 'gastosFijos' | 'categoriasGasto' | 'categoriasRecortar'
  | 'asignacionPlata' | 'tedioso' | 'tediosoComparacion' | 'comoViene'
  | 'intermedia' | 'comoConocio' | 'terminos' | 'login';

const CTA_LABELS: Record<StepKey, string> = {
  intro: 'Empezar',
  nombre: 'Continuar',
  generoEdad: 'Continuar',
  objetivo: 'Continuar',
  situacion: 'Continuar',
  convivencia: 'Continuar',
  zona: 'Continuar',
  ingresos: 'Continuar',
  estabilidadIngresos: 'Continuar',
  gastosFijos: 'Continuar',
  categoriasGasto: 'Continuar',
  categoriasRecortar: 'Continuar',
  asignacionPlata: 'Continuar',
  tedioso: 'Continuar',
  tediosoComparacion: 'Continuar',
  comoViene: 'Continuar',
  intermedia: 'Genial, sigamos',
  comoConocio: 'Continuar',
  terminos: 'Aceptar y continuar',
  login: 'Continuar',
};
const SKIPPABLE: StepKey[] = [
  'convivencia', 'zona', 'ingresos', 'estabilidadIngresos', 'gastosFijos',
  'categoriasGasto', 'categoriasRecortar', 'asignacionPlata', 'tedioso', 'comoConocio',
];

// ── Secciones: nombre + fondo propio por bloque de preguntas ───────────
type SeccionId = 'bienvenida' | 'vos' | 'diaadia' | 'cierre';
const SECCION_INFO: Record<SeccionId, { label: string; bg: string }> = {
  bienvenida: { label: '', bg: COLORS.paper },
  vos: { label: 'Vos', bg: COLORS.tint },
  diaadia: { label: 'Tu día a día', bg: COLORS.goldSoft },
  cierre: { label: 'Ya casi', bg: COLORS.brandSoft },
};
const SECCION_DE: Record<StepKey, SeccionId> = {
  intro: 'bienvenida', nombre: 'bienvenida',
  generoEdad: 'vos', objetivo: 'vos', situacion: 'vos', convivencia: 'vos', zona: 'vos',
  ingresos: 'diaadia', estabilidadIngresos: 'diaadia', gastosFijos: 'diaadia',
  categoriasGasto: 'diaadia', categoriasRecortar: 'diaadia', asignacionPlata: 'diaadia',
  tedioso: 'diaadia', tediosoComparacion: 'diaadia', comoViene: 'diaadia',
  intermedia: 'cierre', comoConocio: 'cierre', terminos: 'cierre', login: 'cierre',
};

const FACE_COLOR = COLORS.brand; // no se elige color de perfil — todas las cuentas arrancan igual

const GENEROS: { id: Genero; label: string }[] = [
  { id: 'femenino', label: 'Femenino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'otro', label: 'Otro' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const EDADES: { id: Edad; label: string }[] = [
  { id: '18-24', label: '18 a 24' },
  { id: '25-34', label: '25 a 34' },
  { id: '35-44', label: '35 a 44' },
  { id: '45-54', label: '45 a 54' },
  { id: '55-64', label: '55 a 64' },
  { id: '65+', label: '65 o más' },
];

const SITUACIONES: { id: Situacion; label: string; emoji: string }[] = [
  { id: 'trabaja', label: 'Laburando', emoji: '💼' },
  { id: 'estudia', label: 'Estudiando', emoji: '📚' },
  { id: 'ambas', label: 'Ambas', emoji: '💼📚' },
  { id: 'ninguna', label: 'Ninguna', emoji: '🌤️' },
];

const CONVIVENCIA_OPCIONES = ['Vivo sola/o', 'Con mi pareja', 'Con mi familia', 'Con roommates', 'Tengo hijos/as a cargo', 'Tengo otras personas a cargo'];

const ZONAS: { id: string; label: string }[] = [
  { id: 'CABA', label: 'CABA' },
  { id: 'GBA', label: 'GBA' },
  { id: 'Otra provincia', label: 'Otra provincia' },
  { id: 'Fuera de Argentina', label: 'Fuera de Argentina' },
  { id: 'Prefiero no decir', label: 'Prefiero no decir' },
];

const INGRESOS_OPCIONES = ['Relación de dependencia', 'Changas o freelance', 'Mi propio emprendimiento', 'Beca', 'Mis papás/familia me bancan', 'Por ahora casi no manejo plata propia'];

const ESTABILIDAD: { id: string; label: string }[] = [
  { id: 'Todos los meses, más o menos lo mismo', label: 'Todos los meses, más o menos lo mismo' },
  { id: 'Todos los meses, pero varía bastante', label: 'Todos los meses, pero varía bastante' },
  { id: 'Depende de cuándo sale trabajo', label: 'Depende de cuándo sale trabajo' },
  { id: 'Todavía no es algo regular', label: 'Todavía no es algo regular' },
  { id: 'otro', label: 'Otro' },
];

const GASTOS_FIJOS_OPCIONES = ['Alquiler', 'Cuota de préstamo', 'Tarjeta de crédito', 'Obra social o prepaga', 'Suscripciones', 'Cuota de estudios', 'Ayuda a familiares', 'Ninguno por ahora'];

const CATEGORIAS_GASTO_LABELS = ['Delivery', 'Restaurantes', 'Cafeterías', 'Salidas y entretenimiento', 'Supermercado', 'Transporte', 'Belleza y cuidado personal', 'Ropa', 'Suscripciones', 'Compras online'];

const OBJETIVOS: { id: ObjetivoId; label: string; emoji: string }[] = [
  { id: 'ahorrar', label: 'Ahorrar', emoji: '🐷' },
  { id: 'invertir', label: 'Invertir', emoji: '🌱' },
  { id: 'controlar', label: 'Controlar mis gastos', emoji: '🔍' },
  { id: 'objetivo', label: 'Lograr objetivos puntuales', emoji: '🎯' },
  { id: 'otro', label: 'Otro', emoji: '✍️' },
];

const NIVELES: { id: Nivel; label: string }[] = [
  { id: 'nada', label: 'Nada' },
  { id: 'poco', label: 'Un poco' },
  { id: 'bastante', label: 'Bastante' },
  { id: 'todo', label: 'Todo' },
];

type FilaAsignacion = { id: 'ahorro' | 'inversiones' | 'gastosFijos' | 'gastosVariables'; titulo: string; ejemplo: string };
const FILAS_ASIGNACION: FilaAsignacion[] = [
  { id: 'ahorro', titulo: 'Ahorro', ejemplo: 'Lo que dejás guardado, sin invertir.' },
  { id: 'inversiones', titulo: 'Inversiones', ejemplo: 'Lo que ponés a que rinda (plazo fijo, fondos, etc.)' },
  { id: 'gastosFijos', titulo: 'Gastos fijos', ejemplo: 'Ej: alquiler, cuotas, suscripciones — lo que se repite todos los meses.' },
  { id: 'gastosVariables', titulo: 'Gastos variables', ejemplo: 'Ej: salidas, gustos, delivery — lo que cambia mes a mes.' },
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

// Preview esquemático de cada sección para la pantalla intermedia — nada de
// datos reales, son placeholders explícitamente ilustrativos.
const PREVIEW_INFO: Record<ObjetivoId, { icon: string; titulo: string; desc: string; bg: string }> = {
  controlar: { icon: '🔍', titulo: 'Gastos', desc: 'Vas a ver en qué se te va la plata, separado por sección.', bg: COLORS.coralSoft },
  objetivo: { icon: '🎯', titulo: 'Objetivos', desc: 'Cada meta con su progreso, a tu ritmo.', bg: COLORS.goldSoft },
  ahorrar: { icon: '🐷', titulo: 'Objetivos', desc: 'Vas a ver cuánto llevás ahorrado para lo que te propongas.', bg: COLORS.goldSoft },
  invertir: { icon: '🌱', titulo: 'Inversiones', desc: 'Te va a mostrar en qué te conviene poner tu plata según tu perfil.', bg: COLORS.skySoft },
  otro: { icon: '✨', titulo: 'Tu FINA', desc: 'Armada a tu manera, con lo que nos fuiste contando.', bg: COLORS.tint },
};

const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors';

// "Otro" para preguntas multi-select: siempre es un chip más de la lista (no
// un input aparte que ocupa lugar todo el tiempo). Al tocarlo se abre un
// campo de texto único — si escribís varias separadas por coma, se separan
// solas en varios chips (no hace falta tocar "+ Agregar" por cada una).
function useOtroMulti() {
  const [custom, setCustom] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [txt, setTxt] = useState('');
  function confirmar() {
    const partes = txt.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    if (partes.length > 0) setCustom((c) => Array.from(new Set([...c, ...partes])));
    setTxt('');
  }
  const quitar = (v: string) => setCustom((c) => c.filter((x) => x !== v));
  return { custom, abierto, setAbierto, txt, setTxt, confirmar, quitar };
}
type OtroMulti = ReturnType<typeof useOtroMulti>;

function MultiOtroChips({ base, seleccion, toggle, otro }: { base: string[]; seleccion: string[]; toggle: (v: string) => void; otro: OtroMulti }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {base.map((o) => (
          <Chip key={o} on={seleccion.includes(o)} onClick={() => toggle(o)}>{o}</Chip>
        ))}
        {otro.custom.map((txt) => (
          <Chip key={txt} on onClick={() => otro.quitar(txt)}>✍️ {txt} ✕</Chip>
        ))}
        <Chip on={otro.abierto} onClick={() => otro.setAbierto((v) => !v)}>Otro</Chip>
      </div>
      {otro.abierto && (
        <input
          autoFocus
          className={inputClass}
          placeholder="Escribí y separá con comas si son varias"
          value={otro.txt}
          onChange={(e) => otro.setTxt(e.target.value)}
          onBlur={otro.confirmar}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); otro.confirmar(); } }}
        />
      )}
    </div>
  );
}

export function OnboardingV2() {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nombre, setNombre] = useState('');
  const [genero, setGenero] = useState<Genero>(null);
  const [generoOtroTxt, setGeneroOtroTxt] = useState('');
  const [edad, setEdad] = useState<Edad>(null);
  const [situacion, setSituacion] = useState<Situacion>(null);

  const [rank, setRank] = useState<ObjetivoId[]>([]);
  const [objetivoOtroTxt, setObjetivoOtroTxt] = useState('');

  const [convivencia, setConvivencia] = useState<string[]>([]);
  const convivenciaOtro = useOtroMulti();
  const [zona, setZona] = useState<string | null>(null);

  const [ingresos, setIngresos] = useState<string[]>([]);
  const ingresosOtro = useOtroMulti();
  const [estabilidadIngresos, setEstabilidadIngresos] = useState<string | null>(null);
  const [estabilidadOtroTxt, setEstabilidadOtroTxt] = useState('');

  const [gastosFijos, setGastosFijos] = useState<string[]>([]);
  const gastosFijosOtro = useOtroMulti();

  const [categoriasGasto, setCategoriasGasto] = useState<string[]>([]);
  const categoriasOtro = useOtroMulti();
  const [categoriasRecortarSel, setCategoriasRecortarSel] = useState<string[]>([]);
  const [recortarNinguna, setRecortarNinguna] = useState(false);

  const [asignacion, setAsignacion] = useState<Record<FilaAsignacion['id'], Nivel | null>>({
    ahorro: null, inversiones: null, gastosFijos: null, gastosVariables: null,
  });

  const [tedioso, setTedioso] = useState<'si' | 'no' | null>(null);

  const [comoViene, setComoViene] = useState<ComoVieneId | null>(null);
  const [comoVieneOtroTxt, setComoVieneOtroTxt] = useState('');
  const [comoConocio, setComoConocio] = useState<string | null>(null);
  const [comoConocioOtroTxt, setComoConocioOtroTxt] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pasoLogin, setPasoLogin] = useState<PasoLogin>('datos');
  const [codigoVerif, setCodigoVerif] = useState('');
  const [finished, setFinished] = useState(false);

  // Flujo — casi lineal: lo único condicional es "categorías a recortar"
  // (solo si eligió alguna categoría) y la comparación ilustrativa de
  // "tedioso" (solo si contestó que sí). Las preguntas propias de cada
  // objetivo (metas concretas, plazo, moneda, perfil de inversión) ya NO
  // están acá — se preguntan dentro de Objetivos/Inversiones directamente.
  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = [
      'intro', 'nombre', 'generoEdad', 'objetivo', 'situacion', 'convivencia', 'zona',
      'ingresos', 'estabilidadIngresos', 'gastosFijos', 'categoriasGasto',
    ];
    if (categoriasGasto.length > 0 || categoriasOtro.custom.length > 0) f.push('categoriasRecortar');
    f.push('asignacionPlata', 'tedioso');
    if (tedioso === 'si') f.push('tediosoComparacion');
    f.push('comoViene', 'intermedia', 'comoConocio', 'terminos', 'login');
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriasGasto, categoriasOtro.custom, tedioso]);
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

  const joven = edad === '18-24';
  const comoVieneMsg = comoViene ? COMO_VIENES.find((o) => o.id === comoViene)?.msg : null;
  const categoriasElegidas = [...categoriasGasto, ...categoriasOtro.custom];
  const sufijoGenero = genero === 'masculino' ? 'os' : genero === 'femenino' ? 'as' : '@s';

  function stepValid(key: StepKey): boolean {
    if (key === 'nombre') return nombre.trim().length > 0;
    if (key === 'generoEdad') return !!genero && !!edad;
    if (key === 'objetivo') return rank.length > 0;
    if (key === 'situacion') return !!situacion;
    if (key === 'terminos') return aceptoTerminos;
    if (key === 'login') {
      if (pasoLogin === 'datos') return email.trim().length > 0 && password.length >= 6 && telefono.trim().length >= 8;
      return codigoVerif.trim().length >= 4;
    }
    return true;
  }

  function resuelto(valor: string | null, txt: string): string | null {
    if (valor === 'otro') return txt.trim() || null;
    return valor;
  }

  function guardarTodo() {
    saveV2Nombre(nombre.trim());
    saveV2Categorias(categoriasElegidas);
    saveV2PerfilOnboarding({
      zona,
      convivencia: [...convivencia, ...convivenciaOtro.custom],
      ingresos: [...ingresos, ...ingresosOtro.custom],
      estabilidadIngresos: resuelto(estabilidadIngresos, estabilidadOtroTxt),
      margenPropio: null,
      gastosFijos: [...gastosFijos, ...gastosFijosOtro.custom],
      categoriasRecortar: recortarNinguna ? [] : categoriasRecortarSel,
      ahorra: asignacion.ahorro,
      invierte: asignacion.inversiones,
      controlaGastos: asignacion.gastosFijos,
      comoConocio: resuelto(comoConocio, comoConocioOtroTxt),
    });
    saveV2TerminosAceptados(aceptoTerminos);
  }

  function onNext() {
    if (currentKey === 'login') {
      if (finished) { navigate('/onboarding-v2/home'); return; }
      if (!stepValid('login')) return;
      if (pasoLogin === 'datos') { setPasoLogin('verificar'); return; }
      guardarTodo();
      setFinished(true);
      return;
    }
    if (!stepValid(currentKey)) return;
    setCurrentIdx((i) => Math.min(i + 1, flow.length - 1));
  }
  function onSkip() {
    setCurrentIdx((i) => Math.min(i + 1, flow.length - 1));
  }
  function onBack() {
    setCurrentIdx((i) => Math.max(i - 1, 0));
  }

  const showTop = currentIdx > 0 && currentKey !== 'login';

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

  const ctaLabel = finished
    ? 'Ir a mi FINA'
    : currentKey === 'login'
      ? (pasoLogin === 'datos' ? 'Continuar' : 'Verificar y empezar')
      : CTA_LABELS[currentKey];

  // Orden de los preview de la pantalla intermedia según cómo rankeó — sin
  // duplicar título si dos objetivos apuntan a la misma sección.
  const previewsOrdenados = (() => {
    const ids = rank.length > 0 ? rank : (['controlar', 'objetivo', 'invertir'] as ObjetivoId[]);
    const vistos = new Set<string>();
    return ids
      .map((id) => PREVIEW_INFO[id])
      .filter((p) => {
        if (vistos.has(p.titulo)) return false;
        vistos.add(p.titulo);
        return true;
      });
  })();

  return (
    <DeviceFrame>
      <div className="flex-1 min-h-0 flex flex-col transition-colors duration-300" style={{ background: seccionActual.bg }}>
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

        <div className="flex-1 min-h-0 flex flex-col px-[22px] py-4 overflow-y-auto gap-4">
          <motion.div
              key={finished ? 'finished' : currentKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {/* INTRO — más grande y con más aire, es la primera impresión */}
              {currentKey === 'intro' && (
                <>
                  <h1 className="text-[28px] font-bold leading-tight pt-2" style={{ color: COLORS.ink }}>
                    Llegó tu momento de cambiar la historia de tus finanzas 💪
                  </h1>
                  <div className="flex flex-col gap-4 bg-white rounded-[18px] p-5 shadow-[0_2px_20px_rgba(31,27,46,0.07)]">
                    {['Conocé tus gastos', 'Lográ tus objetivos', 'Cuidá tu bienestar financiero'].map((txt) => (
                      <div key={txt} className="flex items-center gap-3 text-[16px] font-semibold" style={{ color: COLORS.ink }}>
                        <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brand }}>
                          <CheckIcon />
                        </span>
                        {txt}
                      </div>
                    ))}
                  </div>
                  <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Todo esto, a tu ritmo — no hace falta que sepas nada todavía.</p>
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
                </>
              )}

              {/* OBJETIVO (ranking) — primero de todo el cuestionario en sí, define el orden de la pantalla final */}
              {currentKey === 'objetivo' && (
                <>
                  <h1 className="text-[23px] font-bold leading-snug" style={{ color: COLORS.ink }}>¿Hacia qué objetivos/logros deberíamos trabajar junt{sufijoGenero}?</h1>
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
                </>
              )}

              {/* CONVIVENCIA */}
              {currentKey === 'convivencia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Contanos un poco de tu día a día: ¿con quién compartís tu casa?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí todas las que apliquen.</p>
                  <MultiOtroChips base={CONVIVENCIA_OPCIONES} seleccion={convivencia} toggle={toggleConvivencia} otro={convivenciaOtro} />
                </>
              )}

              {/* ZONA */}
              {currentKey === 'zona' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En dónde andás viviendo?</h1>
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
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿De dónde vienen tus ingresos hoy?</h1>
                  <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>🔒 Esto es solo tuyo — nadie más lo ve. Elegí todas las que apliquen.</p>
                  <MultiOtroChips base={INGRESOS_OPCIONES} seleccion={ingresos} toggle={toggleIngresos} otro={ingresosOtro} />
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

              {/* GASTOS FIJOS */}
              {currentKey === 'gastosFijos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Tenés algún gasto grande que se te repite todos los meses?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>No hace falta el monto, solo si existe.</p>
                  <MultiOtroChips base={GASTOS_FIJOS_OPCIONES} seleccion={gastosFijos} toggle={toggleGastosFijos} otro={gastosFijosOtro} />
                </>
              )}

              {/* CATEGORIAS DE GASTO */}
              {currentKey === 'categoriasGasto' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En qué se te suele ir la plata día a día?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí las que quieras — con esto ya te armamos las secciones en Gastos.</p>
                  <MultiOtroChips
                    base={CATEGORIAS_GASTO_LABELS}
                    seleccion={categoriasGasto}
                    toggle={toggleCategoriaGasto}
                    otro={categoriasOtro}
                  />
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

              {/* ASIGNACIÓN DE LA PLATA — reemplaza a "cuánto es tuya" + ahorrás/invertís/controlás en una sola pantalla */}
              {currentKey === 'asignacionPlata' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>De esta plata, ¿cuánto va a...?</h1>
                  <div className="flex flex-col gap-4">
                    {FILAS_ASIGNACION.map((fila) => (
                      <div key={fila.id} className="flex flex-col gap-1.5">
                        <p className="text-[14.5px] font-bold" style={{ color: COLORS.ink }}>{fila.titulo}</p>
                        <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>{fila.ejemplo}</p>
                        <div className="flex flex-wrap gap-2">
                          {NIVELES.map((n) => (
                            <Chip key={n.id} on={asignacion[fila.id] === n.id} onClick={() => setAsignacion((a) => ({ ...a, [fila.id]: n.id }))}>{n.label}</Chip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* TEDIOSO */}
              {currentKey === 'tedioso' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Se te hace tedioso llevar el control de tu plata?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <Chip on={tedioso === 'si'} onClick={() => setTedioso('si')}>Sí</Chip>
                    <Chip on={tedioso === 'no'} onClick={() => setTedioso('no')}>No</Chip>
                  </div>
                </>
              )}

              {/* COMPARACION ILUSTRATIVA — solo si dijo que sí */}
              {currentKey === 'tediosoComparacion' && (
                <>
                  <h1 className="text-[23px] font-bold leading-snug" style={{ color: COLORS.ink }}>Con el bot, ni te das cuenta</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Le contás un gasto hablando y nosotras armamos el registro — vos seguís con tu día.</p>
                  <div className="bg-white rounded-[18px] p-4 flex flex-col gap-3 shadow-[0_2px_20px_rgba(31,27,46,0.07)]">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[12.5px] font-semibold" style={{ color: COLORS.inkSoft }}>Por tu cuenta</p>
                      <div className="h-3 rounded-full" style={{ width: '92%', background: COLORS.coral }} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[12.5px] font-semibold" style={{ color: COLORS.inkSoft }}>Con FINA y el bot</p>
                      <div className="h-3 rounded-full" style={{ width: '18%', background: COLORS.green }} />
                    </div>
                    <p className="text-[11.5px]" style={{ color: COLORS.inkFaint }}>Ilustrativo — no es una medición real todavía.</p>
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

              {/* INTERMEDIA — previews esquemáticos ordenados por prioridad + explicación del bot */}
              {currentKey === 'intermedia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Así se va a ir viendo tu FINA</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>En el orden que nos dijiste que te importa.</p>
                  <div className="flex flex-col gap-3">
                    {previewsOrdenados.map((p) => (
                      <div key={p.titulo} className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: p.bg }}>
                        <span className="text-2xl shrink-0">{p.icon}</span>
                        <div>
                          <p className="font-bold text-[14px]" style={{ color: COLORS.ink }}>{p.titulo}</p>
                          <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>{p.desc}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: COLORS.ink }}>
                      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(244,241,250,0.15)' }}>💬</span>
                      <div>
                        <p className="font-bold text-[14px]" style={{ color: '#fff' }}>Tu bot de WhatsApp</p>
                        <p className="text-[12.5px]" style={{ color: 'rgba(244,241,250,0.7)' }}>Es el botón redondo del medio, abajo de todo — contale un gasto hablando y listo, sin abrir la app.</p>
                      </div>
                    </div>
                  </div>
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

              {/* LOGIN — datos + verificación de teléfono (mock, no hay backend todavía) — o confirmación final */}
              {currentKey === 'login' && !finished && pasoLogin === 'datos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Guardá tu progreso</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todos los meses vas a poder ver cómo venís.</p>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Mail</label>
                    <input className={inputClass} placeholder="vos@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Contraseña</label>
                    <input type="password" className={inputClass} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Teléfono</label>
                    <input className={inputClass} placeholder="+54 9 11 ...." value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  </div>
                </>
              )}

              {currentKey === 'login' && !finished && pasoLogin === 'verificar' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Verificá tu teléfono</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Te mandamos un código a {telefono || 'tu teléfono'}.</p>
                  <input className={inputClass} placeholder="Código" inputMode="numeric" value={codigoVerif} onChange={(e) => setCodigoVerif(e.target.value)} />
                  <p className="text-[12px]" style={{ color: COLORS.inkFaint }}>Modo de prueba: todavía no mandamos SMS de verdad — escribí cualquier código de 4 a 6 dígitos.</p>
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
          <Cta label={ctaLabel} disabled={!finished && !stepValid(currentKey)} onClick={onNext} />
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

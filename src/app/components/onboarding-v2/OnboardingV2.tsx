import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  COLORS, DeviceFrame, Face, CheckIcon, Chip, OtroChip, Nota, Cta,
  formatThousands, parseMoneyInput,
  saveV2Categorias, saveV2Nombre,
  saveV2PerfilOnboarding, saveV2TerminosAceptados,
  saveV2InversionesPerfil, saveV2ObjetivosState,
} from './shared';
import { IconChat, IconChevron, IconBasura } from './FinaIcons';

// REDISEÑO — Onboarding v2 (rama dev)
//
// Sandbox aislado — el estado es 100% local (localStorage), no hay backend
// todavía. TONO: ninguna pregunta pide un monto ni una cifra exacta — todo
// se pregunta como quien cuenta su situación. "Otro" siempre es una opción
// más (con su propio estilo de "caja para escribir", no un chip igual a
// los demás) y lo que se escribe ahí se guarda de verdad.
//
// SECCIONES: cada bloque de preguntas tiene nombre + fondo propio; la barra
// de arriba es un segmento por sección.
//
// Las preguntas específicas de cada área (objetivos concretos + su plazo y
// moneda, el perfil de inversión) NO se preguntan acá — se completan dentro
// de Objetivos/Inversiones la primera vez que se entra a esa sección.

type Genero = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir' | null;
type Edad = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | null;
type Situacion = 'trabaja' | 'estudia' | 'ambas' | 'ninguna' | null;
type ObjetivoId = 'invertir' | 'ahorrar' | 'objetivo' | 'no_claro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';
type Nivel = 'nada' | 'poco' | 'bastante' | 'todo';
type PasoLogin = 'datos' | 'verificar';

type StepKey =
  | 'intro' | 'nombre' | 'generoEdad' | 'objetivo' | 'situacion' | 'zona'
  | 'ingresos' | 'estabilidadIngresos' | 'tedioso'
  | 'perfilInversor' | 'objetivoInversion' | 'definirObjetivo'
  | 'intermedia' | 'comoConocio' | 'terminos' | 'login';

const CTA_LABELS: Record<StepKey, string> = {
  intro: 'Empezar',
  nombre: 'Continuar',
  generoEdad: 'Continuar',
  objetivo: 'Continuar',
  situacion: 'Continuar',
  zona: 'Continuar',
  ingresos: 'Continuar',
  estabilidadIngresos: 'Continuar',
  tedioso: 'Continuar',
  perfilInversor: 'Continuar',
  objetivoInversion: 'Continuar',
  definirObjetivo: 'Guardar objetivo',
  intermedia: 'Genial, sigamos',
  comoConocio: 'Continuar',
  terminos: 'Aceptar y continuar',
  login: 'Continuar',
};
const SKIPPABLE: StepKey[] = [
  'zona', 'ingresos', 'estabilidadIngresos', 'comoConocio',
];

type SeccionId = 'bienvenida' | 'vos' | 'diaadia' | 'cierre';
const SECCION_INFO: Record<SeccionId, { label: string; bg: string }> = {
  bienvenida: { label: '', bg: COLORS.paper },
  vos: { label: 'Vos', bg: COLORS.tint },
  diaadia: { label: 'Tu día a día', bg: COLORS.goldSoft },
  cierre: { label: 'Ya casi', bg: COLORS.brandSoft },
};
const SECCION_DE: Record<StepKey, SeccionId> = {
  intro: 'bienvenida', nombre: 'bienvenida',
  generoEdad: 'vos', objetivo: 'vos', situacion: 'vos', zona: 'vos',
  ingresos: 'diaadia', estabilidadIngresos: 'diaadia', tedioso: 'diaadia',
  perfilInversor: 'diaadia', objetivoInversion: 'diaadia', definirObjetivo: 'diaadia',
  intermedia: 'cierre', comoConocio: 'cierre', terminos: 'cierre', login: 'cierre',
};

const FACE_COLOR = COLORS.brand;

const GENEROS: { id: Genero; label: string; muted?: boolean }[] = [
  { id: 'femenino', label: 'Femenino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'otro', label: 'Otro' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', muted: true },
];

const EDADES: { id: Edad; label: string }[] = [
  { id: '18-24', label: '18 a 24' },
  { id: '25-34', label: '25 a 34' },
  { id: '35-44', label: '35 a 44' },
  { id: '45-54', label: '45 a 54' },
  { id: '55-64', label: '55 a 64' },
  { id: '65+', label: '65 o más' },
];

// Texto puro, sin emoji como marcador de opción (§2, §5.4). El chip ya es
// texto — la opción se distingue por la palabra, no por un pictograma.
const SITUACIONES: { id: Situacion; label: string }[] = [
  { id: 'trabaja', label: 'Laburando' },
  { id: 'estudia', label: 'Estudiando' },
  { id: 'ambas', label: 'Ambas' },
  { id: 'ninguna', label: 'Ninguna' },
];

const OBJETIVOS: { id: ObjetivoId; label: string }[] = [
  { id: 'invertir', label: 'Invertir' },
  { id: 'ahorrar', label: 'Ahorrar' },
  { id: 'objetivo', label: 'Lograr un objetivo puntual' },
  { id: 'no_claro', label: 'Todavía no lo tengo claro' },
];

const BUBBLE_POR_TOP: Record<ObjetivoId, string> = {
  invertir: 'Buenísimo — te ayudamos a que tu plata trabaje para vos.',
  ahorrar: 'Modo ahorro activado. Lo vamos a hacer fácil.',
  objetivo: 'Con la mira puesta en lo que de verdad te importa.',
  no_claro: 'Tranqui — lo vamos descubriendo juntas, a tu ritmo.',
};

const CONVIVENCIA_OPCIONES = ['Vivo sola/o', 'Con mi pareja', 'Con mi familia', 'Con roommates', 'Tengo hijos/as a cargo', 'Tengo otras personas a cargo'];

const ZONAS: { id: string; label: string; muted?: boolean }[] = [
  { id: 'CABA', label: 'CABA' },
  { id: 'GBA', label: 'GBA' },
  { id: 'Otra provincia', label: 'Otra provincia' },
  { id: 'Fuera de Argentina', label: 'Fuera de Argentina' },
  { id: 'Prefiero no decir', label: 'Prefiero no decir', muted: true },
];

const INGRESOS_OPCIONES = [
  'Sueldo en relación de dependencia',
  'Trabajo independiente / freelance',
  'Ingresos de mi propio emprendimiento',
  'Honorarios profesionales',
  'Beca o ayuda de estudio',
  'Aporte de mi familia',
  'Rentas o inversiones',
  'Todavía no genero ingresos propios',
];

const ESTABILIDAD: { id: string; label: string }[] = [
  { id: 'Monto fijo y previsible todos los meses', label: 'Monto fijo y previsible todos los meses' },
  { id: 'Regular, pero con variaciones mes a mes', label: 'Regular, pero con variaciones mes a mes' },
  { id: 'Variable según el trabajo de cada mes', label: 'Variable según el trabajo de cada mes' },
  { id: 'De forma ocasional o esporádica', label: 'De forma ocasional o esporádica' },
];

// Gastos fijos — combina lo que ya usa la app real (Alquiler/expensas,
// Suscripciones, Supermercado, Prepaga, Belleza, Terapia, Gimnasio,
// Estudios, Transporte — ver ExpensesFixed.tsx) con lo que todavía no
// registra pero un asesor necesita saber (tarjeta, préstamo, ayuda familiar).
const GASTOS_FIJOS_OPCIONES: { value: string; display: string; muted?: boolean }[] = [
  { value: 'Alquiler o expensas', display: 'Alquiler o expensas' },
  { value: 'Suscripciones', display: 'Suscripciones' },
  { value: 'Supermercado', display: 'Supermercado' },
  { value: 'Prepaga u obra social', display: 'Prepaga u obra social' },
  { value: 'Belleza y cuidado personal', display: 'Belleza y cuidado personal' },
  { value: 'Psicóloga o terapia', display: 'Psicóloga o terapia' },
  { value: 'Gimnasio', display: 'Gimnasio' },
  { value: 'Estudios', display: 'Estudios' },
  { value: 'Transporte (seguro, nafta, boleto)', display: 'Transporte (seguro, nafta, boleto)' },
  { value: 'Tarjeta de crédito', display: 'Tarjeta de crédito' },
  { value: 'Cuota de préstamo', display: 'Cuota de préstamo' },
  { value: 'Ayuda a familiares', display: 'Ayuda a familiares' },
  { value: 'Ninguno por ahora', display: 'Ninguno por ahora', muted: true },
];

const CATEGORIAS_GASTO: { value: string; display: string }[] = [
  { value: 'Delivery', display: 'Delivery' },
  { value: 'Restaurantes', display: 'Restaurantes' },
  { value: 'Cafeterías', display: 'Cafeterías' },
  { value: 'Salidas y entretenimiento', display: 'Salidas y entretenimiento' },
  { value: 'Supermercado', display: 'Supermercado' },
  { value: 'Transporte', display: 'Transporte' },
  { value: 'Belleza y cuidado personal', display: 'Belleza y cuidado personal' },
  { value: 'Ropa', display: 'Ropa' },
  { value: 'Suscripciones', display: 'Suscripciones' },
  { value: 'Compras online', display: 'Compras online' },
];

const NIVELES: { id: Nivel; label: string }[] = [
  { id: 'nada', label: 'Nada' },
  { id: 'poco', label: 'Poco' },
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

const COMO_VIENES: { id: ComoVieneId; label: string; msg: string; muted?: boolean }[] = [
  { id: 'justo', label: 'Me alcanza justo', msg: 'Genial — vamos a ayudarte a que te sobre cada vez más.' },
  { id: 'sobra', label: 'Me sobra un poco', msg: 'Buenísimo, te ayudamos a que ese sobrante trabaje para vos.' },
  { id: 'no_llega', label: 'No llego a fin de mes', msg: 'No te preocupes, vinimos justo para eso.' },
  { id: 'hago_lo_que_quiero', label: 'Hago lo que quiero', msg: 'Como a vos te gusta — te ayudamos a que te dure más.' },
  { id: 'no_lo_tengo_en_cuenta', label: 'No lo tengo muy en cuenta', msg: 'Te vamos a hacer mucho más fácil tenerlo en cuenta.' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', msg: 'Todo bien — lo vamos descubriendo juntas, a tu ritmo.', muted: true },
];

const COMO_CONOCIO: { id: string; label: string }[] = [
  { id: 'Instagram', label: 'Instagram' },
  { id: 'TikTok', label: 'TikTok' },
  { id: 'Recomendación de una amiga', label: 'Recomendación de una amiga' },
  { id: 'Buscando en Google', label: 'Buscando en Google' },
  { id: 'Una charla o evento', label: 'Una charla o evento' },
];

const PREVIEW_INFO: Record<ObjetivoId, { titulo: string; desc: string; bg: string }> = {
  invertir: { titulo: 'Inversiones', desc: 'Según tu perfil, te mostramos en qué te conviene poner tu plata para que rinda.', bg: COLORS.skySoft },
  ahorrar: { titulo: 'Ahorro', desc: 'Apartás plata en tu reserva y ves crecer cuánto llevás guardado, sin tentarte.', bg: COLORS.goldSoft },
  objetivo: { titulo: 'Objetivos', desc: 'Tu meta con su progreso — vas viendo cuánto te falta para lograrla.', bg: COLORS.goldSoft },
  no_claro: { titulo: 'Tu FINA', desc: 'Gastos, ahorro, objetivos e inversiones — todo en un lugar, a tu ritmo.', bg: COLORS.tint },
};

// Inputs: la clase solo lleva forma/espacio; el color sale de COLORS (sin hex
// crudo, §3.3). El foco visible lo da .v2-focus (--focus-ring, §11), así no hace
// falta el `focus:border-...` con hex. El borde de error usa naranja (atención
// accionable real, §3.3), nunca un rojo de alerta.
const inputClass = 'v2-focus rounded-2xl px-4 py-3 text-[15px] outline-none transition-colors';
function inputStyle(err = false): React.CSSProperties {
  return { background: COLORS.surface, color: COLORS.ink, border: `1px solid ${err ? COLORS.naranja : COLORS.line}` };
}

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
type OpcionMulti = { value: string; display: string; muted?: boolean };

function MultiOtroChips({ opciones, seleccion, toggle, otro }: { opciones: OpcionMulti[]; seleccion: string[]; toggle: (v: string) => void; otro: OtroMulti }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {opciones.map((o) => (
          <Chip key={o.value} on={seleccion.includes(o.value)} muted={o.muted} onClick={() => toggle(o.value)}>{o.display}</Chip>
        ))}
        {otro.custom.map((txt) => (
          <Chip key={txt} on onClick={() => otro.quitar(txt)}>
            {txt}
            <span aria-label="Quitar" className="inline-flex"><IconBasura size={14} /></span>
          </Chip>
        ))}
        <OtroChip abierto={otro.abierto} onClick={() => otro.setAbierto((v) => !v)} />
      </div>
      {otro.abierto && (
        <input
          autoFocus
          aria-label="Escribí tu opción"
          className={inputClass}
          style={inputStyle()}
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

function emailValido(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function passwordValida(v: string) { return v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v); }
function telefonoValido(v: string) { return v.replace(/\D/g, '').length >= 8; }
function formatearTelefonoAr(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>{label}</label>
      {children}
      {error && <p className="text-[12px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
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

  // "¿Qué querés lograr?" — ahora es UNA sola opción (no ranking).
  const [meta, setMeta] = useState<ObjetivoId | null>(null);

  // Rama "Invertir": mini perfil de inversor — se guarda con las MISMAS
  // opciones que usa InversionesV2, así esa pantalla arranca precargada.
  const [invReaccion, setInvReaccion] = useState<string | null>(null);
  const [invYaInvierte, setInvYaInvierte] = useState<'si' | 'no' | null>(null);
  const [invPorQue, setInvPorQue] = useState<string | null>(null);

  // Rama "Objetivo puntual": se define acá y aparece ya cargado en Objetivos.
  const [objNombre, setObjNombre] = useState('');
  const [objMonto, setObjMonto] = useState('');
  const [objMoneda, setObjMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [objFecha, setObjFecha] = useState('');

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

  const [comoViene, setComoViene] = useState<ComoVieneId[]>([]);
  const [comoVieneOtroTxt, setComoVieneOtroTxt] = useState('');
  const [comoConocio, setComoConocio] = useState<string | null>(null);
  const [comoConocioOtroTxt, setComoConocioOtroTxt] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pasoLogin, setPasoLogin] = useState<PasoLogin>('datos');
  const [intentoLogin, setIntentoLogin] = useState(false);
  const [codigoVerif, setCodigoVerif] = useState('');
  const [finished, setFinished] = useState(false);

  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = [
      'intro', 'nombre', 'generoEdad', 'objetivo', 'situacion', 'zona',
      'ingresos', 'estabilidadIngresos', 'tedioso',
    ];
    // Ramas según lo que quiere lograr:
    if (meta === 'invertir') f.push('perfilInversor', 'objetivoInversion');
    else if (meta === 'objetivo') f.push('definirObjetivo');
    // 'ahorrar' y 'no_claro' siguen el flujo normal, sin pasos extra.
    f.push('intermedia', 'comoConocio', 'terminos', 'login');
    return f;
  }, [meta]);
  const currentKey = flow[Math.min(currentIdx, flow.length - 1)];
  const seccionActual = SECCION_INFO[SECCION_DE[currentKey]];

  const toggleMulti = (setter: (fn: (v: string[]) => string[]) => void) => (id: string) =>
    setter((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const toggleConvivencia = toggleMulti(setConvivencia);
  const toggleIngresos = toggleMulti(setIngresos);
  const toggleGastosFijos = toggleMulti(setGastosFijos);
  const toggleCategoriaGasto = toggleMulti(setCategoriasGasto);
  const toggleComoViene = (id: ComoVieneId) =>
    setComoViene((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const toggleCategoriaRecortar = (id: string) => {
    setRecortarNinguna(false);
    setCategoriasRecortarSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  };

  const objetivoBubble = meta ? BUBBLE_POR_TOP[meta] : 'No te vas a arrepentir...';
  const categoriasElegidas = [...categoriasGasto, ...categoriasOtro.custom];
  const sufijoGenero = genero === 'masculino' ? 'os' : genero === 'femenino' ? 'as' : '@s';

  const telefonoOk = telefonoValido(telefono);
  const emailOk = emailValido(email);
  const passwordOk = passwordValida(password);

  function stepValid(key: StepKey): boolean {
    if (key === 'nombre') return nombre.trim().length > 0;
    if (key === 'generoEdad') return !!genero && !!edad;
    if (key === 'objetivo') return !!meta;
    if (key === 'situacion') return !!situacion;
    if (key === 'perfilInversor') return !!invReaccion && !!invYaInvierte;
    if (key === 'objetivoInversion') return !!invPorQue;
    if (key === 'definirObjetivo') return objNombre.trim().length > 0 && parseMoneyInput(objMonto) > 0;
    if (key === 'terminos') return aceptoTerminos;
    if (key === 'login') {
      if (pasoLogin === 'datos') return emailOk && passwordOk && telefonoOk;
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
      meta,
    });
    saveV2TerminosAceptados(aceptoTerminos);

    // Rama "Invertir" → dejamos el perfil listo para que Inversiones arranque
    // ya calculado (mismas opciones que usa esa pantalla).
    if (meta === 'invertir' && invReaccion && invPorQue) {
      saveV2InversionesPerfil({ porQue: invPorQue, reaccion: invReaccion, yaInvierte: invYaInvierte ?? undefined });
    }

    // Rama "Objetivo puntual" → creamos el objetivo ya cargado en Objetivos.
    if (meta === 'objetivo' && objNombre.trim() && parseMoneyInput(objMonto) > 0) {
      const horizonte = objFecha
        ? new Date(objFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Lo antes posible';
      saveV2ObjetivosState([{
        id: `onb-${Date.now()}`,
        nombre: objNombre.trim(),
        descripcion: '',
        tipo: 'individual',
        moneda: objMoneda,
        horizonte,
        montoModo: 'exacto',
        montoTotal: parseMoneyInput(objMonto),
        contribuciones: [],
      }]);
    }
  }

  function onNext() {
    if (currentKey === 'login') {
      if (finished) { navigate('/onboarding-v2/home'); return; }
      setIntentoLogin(true);
      if (!stepValid('login')) return;
      if (pasoLogin === 'datos') { setPasoLogin('verificar'); setIntentoLogin(false); return; }
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

  // La pantalla intermedia se arma según lo que eligió — mostramos primero
  // la función más relevante a su elección, para generar ganas de entrar.
  const previewsOrdenados = (() => {
    const orden: Record<ObjetivoId, ObjetivoId[]> = {
      invertir: ['invertir', 'objetivo', 'ahorrar'],
      ahorrar: ['ahorrar', 'objetivo', 'invertir'],
      objetivo: ['objetivo', 'ahorrar', 'invertir'],
      no_claro: ['ahorrar', 'objetivo', 'invertir'],
    };
    const ids = meta ? orden[meta] : (['ahorrar', 'objetivo', 'invertir'] as ObjetivoId[]);
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
          <div className="px-[22px] pt-5 pb-1 flex items-center gap-3 w-full lg:max-w-xl lg:mx-auto lg:pt-10">
            {currentIdx > 0 && (
              <button type="button" onClick={onBack} aria-label="Volver a la pregunta anterior" className="v2-focus shrink-0 w-11 h-11 -ml-1.5 flex items-center justify-center rounded-full transition-all duration-100 active:scale-90" style={{ color: COLORS.ink }}>
                <IconChevron size={22} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
            <div className="flex-1 flex flex-col gap-1">
              {seccionActual.label && (
                <p className="text-[11.5px] font-semibold" style={{ color: COLORS.inkSoft }}>{seccionActual.label}</p>
              )}
              <div className="flex gap-1">
                {segmentos.map((s) => (
                  <div key={s} className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: COLORS.lineStrong }}>
                    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${fillDeSeccion(s)}%`, background: COLORS.brand }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col px-[22px] py-4 overflow-y-auto gap-4 w-full lg:max-w-xl lg:mx-auto">
          <motion.div
              key={finished ? 'finished' : currentKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              {currentKey === 'intro' && (
                <>
                  <h1 className="text-[28px] font-bold leading-tight pt-2" style={{ color: COLORS.ink }}>
                    Llegó tu momento de cambiar la historia de tus finanzas
                  </h1>
                  <div className="flex flex-col gap-4 rounded-[18px] p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
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

              {currentKey === 'nombre' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cómo te llamamos?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Así te vamos a hablar de acá en adelante.</p>
                  <input
                    autoFocus
                    aria-label="Tu nombre"
                    className={inputClass}
                    style={inputStyle()}
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onNext(); }}
                  />
                </>
              )}

              {currentKey === 'generoEdad' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Con qué género te identificás?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {GENEROS.map((o) => (
                      <Chip key={o.id} on={genero === o.id} muted={o.muted} onClick={() => setGenero(o.id)}>{o.label}</Chip>
                    ))}
                    <OtroChip abierto={genero === 'otro'} onClick={() => setGenero('otro')} />
                  </div>
                  {genero === 'otro' && (
                    <input autoFocus aria-label="Contanos cómo te identificás" className={inputClass} style={inputStyle()} placeholder="Contanos cómo te identificás" value={generoOtroTxt} onChange={(e) => setGeneroOtroTxt(e.target.value)} />
                  )}
                  <h1 className="text-[23px] font-bold mt-2.5" style={{ color: COLORS.ink }}>¿Qué edad tenés?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {EDADES.map((o) => (
                      <Chip key={o.id} on={edad === o.id} onClick={() => setEdad(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'objetivo' && (
                <>
                  <h1 className="text-[23px] font-bold leading-snug" style={{ color: COLORS.ink }}>¿Qué es lo que más querés lograr con tu plata?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Elegí la que mejor te represente hoy — después vas a poder hacer todo lo demás igual.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {OBJETIVOS.map((o) => (
                      <Chip key={o.id} on={meta === o.id} onClick={() => setMeta(o.id)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex justify-center py-1"><Face color={FACE_COLOR} size={90} mood="happy" /></div>
                  {meta && (
                    <div className="self-center max-w-[82%] text-center rounded-2xl px-4 py-3 text-[13.5px] font-semibold" style={{ color: COLORS.ink, background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
                      {objetivoBubble}
                    </div>
                  )}
                </>
              )}

              {currentKey === 'situacion' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Contanos, ¿en qué andás?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {SITUACIONES.map((o) => (
                      <Chip key={o.id} on={situacion === o.id} onClick={() => setSituacion(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'convivencia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Contanos un poco de tu día a día: ¿con quién compartís tu casa?</h1>
                  <Nota>Elegí todas las que apliquen.</Nota>
                  <MultiOtroChips opciones={CONVIVENCIA_OPCIONES.map((v) => ({ value: v, display: v }))} seleccion={convivencia} toggle={toggleConvivencia} otro={convivenciaOtro} />
                </>
              )}

              {currentKey === 'zona' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En dónde andás viviendo?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {ZONAS.map((o) => (
                      <Chip key={o.id} on={zona === o.id} muted={o.muted} onClick={() => setZona(o.id)}>{o.label}</Chip>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'ingresos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿De dónde vienen tus ingresos hoy?</h1>
                  <Nota>Esto es solo tuyo — nadie más lo ve. Elegí todas las que apliquen.</Nota>
                  <MultiOtroChips opciones={INGRESOS_OPCIONES.map((v) => ({ value: v, display: v }))} seleccion={ingresos} toggle={toggleIngresos} otro={ingresosOtro} />
                </>
              )}

              {currentKey === 'estabilidadIngresos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Con qué regularidad recibís tus ingresos?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {ESTABILIDAD.map((o) => (
                      <Chip key={o.id} on={estabilidadIngresos === o.id} onClick={() => setEstabilidadIngresos(o.id)}>{o.label}</Chip>
                    ))}
                    <OtroChip abierto={estabilidadIngresos === 'otro'} onClick={() => setEstabilidadIngresos('otro')} />
                  </div>
                  {estabilidadIngresos === 'otro' && (
                    <input autoFocus aria-label="Contanos más sobre tus ingresos" className={inputClass} style={inputStyle()} placeholder="Contanos más" value={estabilidadOtroTxt} onChange={(e) => setEstabilidadOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {currentKey === 'gastosFijos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Tenés algún gasto grande que se te repite todos los meses?</h1>
                  <Nota>No hace falta el monto, solo si existe.</Nota>
                  <MultiOtroChips opciones={GASTOS_FIJOS_OPCIONES} seleccion={gastosFijos} toggle={toggleGastosFijos} otro={gastosFijosOtro} />
                </>
              )}

              {currentKey === 'categoriasGasto' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿En qué se te suele ir la plata día a día?</h1>
                  <Nota>Elegí las que quieras — con esto ya te armamos las secciones en Gastos.</Nota>
                  <MultiOtroChips opciones={CATEGORIAS_GASTO} seleccion={categoriasGasto} toggle={toggleCategoriaGasto} otro={categoriasOtro} />
                </>
              )}

              {currentKey === 'categoriasRecortar' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Hay alguna de estas en la que te gustaría gastar menos?</h1>
                  <Nota>Así te avisamos si te conviene ponerle un tope.</Nota>
                  <div className="flex flex-wrap gap-2.5">
                    {categoriasElegidas.map((c) => (
                      <Chip key={c} on={categoriasRecortarSel.includes(c)} onClick={() => toggleCategoriaRecortar(c)}>{c}</Chip>
                    ))}
                    <Chip muted on={recortarNinguna} onClick={() => { setRecortarNinguna(true); setCategoriasRecortarSel([]); }}>Ninguna por ahora</Chip>
                  </div>
                </>
              )}

              {currentKey === 'asignacionPlata' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>De esta plata, ¿cuánto va a...?</h1>
                  <div className="flex flex-col gap-4">
                    {FILAS_ASIGNACION.map((fila) => (
                      <div key={fila.id} className="flex flex-col gap-1.5">
                        <p className="text-[14.5px] font-bold" style={{ color: COLORS.ink }}>{fila.titulo}</p>
                        <Nota>{fila.ejemplo}</Nota>
                        <div className="flex gap-1.5">
                          {NIVELES.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => setAsignacion((a) => ({ ...a, [fila.id]: n.id }))}
                              className="v2-focus flex-1 rounded-xl py-2.5 text-[12.5px] font-bold transition-all duration-100 active:scale-95"
                              style={asignacion[fila.id] === n.id ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.surface, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}
                            >
                              {n.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'tedioso' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Se te hace tedioso llevar el control de tu plata?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <Chip on={tedioso === 'si'} onClick={() => setTedioso('si')}>Sí</Chip>
                    <Chip on={tedioso === 'no'} onClick={() => setTedioso('no')}>No</Chip>
                  </div>
                  {tedioso && (
                    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.ink }}>
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.darkLine, color: COLORS.onDark }}><IconChat size={24} /></span>
                        <div className="flex flex-col">
                          <p className="text-[15px] font-bold" style={{ color: COLORS.onDark }}>
                            {tedioso === 'si' ? 'Tranqui — para eso está tu FINA en WhatsApp' : 'Igual te va a encantar tu FINA en WhatsApp'}
                          </p>
                          <p className="text-[12.5px]" style={{ color: COLORS.onDarkSoft }}>Sin planillas, sin abrir la app.</p>
                        </div>
                      </div>
                      <p className="text-[13.5px] leading-relaxed" style={{ color: COLORS.onDark }}>
                        Le escribís tu gasto como se lo contarías a una amiga —{' '}
                        <span className="font-semibold" style={{ color: COLORS.onDark }}>“gasté 5.000 en el súper”</span>{' '}
                        — y FINA lo registra sola, al toque. También te responde dudas y te avisa cómo venís.
                      </p>
                    </div>
                  )}
                </>
              )}

              {currentKey === 'comoViene' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cómo venís con tu plata?</h1>
                  <Nota>Elegí todas las que apliquen.</Nota>
                  <div className="flex flex-wrap gap-2.5">
                    {COMO_VIENES.map((o) => (
                      <Chip key={o.id} on={comoViene.includes(o.id)} muted={o.muted} onClick={() => toggleComoViene(o.id)}>{o.label}</Chip>
                    ))}
                    <OtroChip abierto={comoViene.includes('otro')} onClick={() => toggleComoViene('otro')} />
                  </div>
                  {comoViene.includes('otro') && (
                    <input autoFocus aria-label="Contanos más sobre cómo venís" className={inputClass} style={inputStyle()} placeholder="Contanos más" value={comoVieneOtroTxt} onChange={(e) => setComoVieneOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {currentKey === 'perfilInversor' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Armemos tu perfil de inversor</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Dos preguntas rápidas para recomendarte según vos — nunca movemos tu plata, solo te orientamos.</p>
                  <p className="text-[14.5px] font-bold mt-1 leading-snug" style={{ color: COLORS.ink }}>Estás en una inversión que sube y baja en el camino, pero promete crecer a 5 años a una tasa razonable. ¿Qué hacés?</p>
                  <div className="flex flex-wrap gap-2.5">
                    {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
                      <Chip key={o} on={invReaccion === o} onClick={() => setInvReaccion(o)}>{o}</Chip>
                    ))}
                  </div>
                  <p className="text-[14.5px] font-bold mt-2" style={{ color: COLORS.ink }}>¿Ya invertís hoy en algo?</p>
                  <div className="flex flex-wrap gap-2.5">
                    {(['si', 'no'] as const).map((o) => (
                      <Chip key={o} on={invYaInvierte === o} onClick={() => setInvYaInvierte(o)}>{o === 'si' ? 'Sí' : 'No'}</Chip>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'objetivoInversion' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Con qué objetivo querés invertir esa plata?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Con esto afinamos qué opciones tienen más sentido para vos.</p>
                  <div className="flex flex-wrap gap-2.5">
                    {['Sacarla pronto (corto plazo)', 'Dejarla que rinda (largo plazo)'].map((o) => (
                      <Chip key={o} on={invPorQue === o} onClick={() => setInvPorQue(o)}>{o}</Chip>
                    ))}
                  </div>
                </>
              )}

              {currentKey === 'definirObjetivo' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>¿Cuál es ese objetivo?</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Lo dejamos cargado y ya lo vas a ver con su progreso apenas entres.</p>
                  <input autoFocus aria-label="Nombre de tu objetivo" className={inputClass} style={inputStyle()} placeholder="Ej: Viaje a Bariloche" value={objNombre} onChange={(e) => setObjNombre(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
                    <div className="flex rounded-full p-0.5" style={{ background: COLORS.tint }}>
                      {(['ARS', 'USD'] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={objMoneda === m} onClick={() => setObjMoneda(m)} className="v2-focus rounded-full px-3 py-1 text-[12px] font-bold transition-colors" style={objMoneda === m ? { background: COLORS.brand, color: COLORS.surface } : { color: COLORS.inkSoft }}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{objMoneda === 'USD' ? 'US$' : '$'}</span>
                    <input aria-label="Monto total del objetivo" className={`${inputClass} pl-11`} style={inputStyle()} placeholder="Monto total" inputMode="decimal" value={objMonto} onChange={(e) => setObjMonto(formatThousands(e.target.value))} />
                  </div>
                  <p className="text-[14px] font-bold mt-1" style={{ color: COLORS.ink }}>¿Para cuándo? <span className="font-normal text-[13px]" style={{ color: COLORS.inkSoft }}>(opcional)</span></p>
                  <input type="date" aria-label="Fecha del objetivo (opcional)" className={inputClass} style={inputStyle()} value={objFecha} onChange={(e) => setObjFecha(e.target.value)} />
                </>
              )}

              {currentKey === 'intermedia' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>{meta === 'invertir' ? 'Tu plata, lista para crecer' : meta === 'ahorrar' ? 'Tu ahorro, siempre a la vista' : meta === 'objetivo' ? '¡Tu objetivo ya está en marcha!' : 'Así se va a ir viendo tu FINA'}</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{meta === 'invertir' ? 'Con tu perfil listo, esto es lo que te espera adentro.' : meta === 'ahorrar' ? 'Esto es lo que vas a poder hacer para que te sobre cada vez más.' : meta === 'objetivo' ? 'Lo vas a ver con su progreso, y todo esto además.' : 'Todo lo que FINA va a hacer por vos.'}</p>
                  <div className="flex flex-col gap-3">
                    {previewsOrdenados.map((p) => (
                      <div key={p.titulo} className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: p.bg }}>
                        <div>
                          <p className="font-bold text-[14px]" style={{ color: COLORS.ink }}>{p.titulo}</p>
                          <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>{p.desc}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: COLORS.ink }}>
                      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.darkLine, color: COLORS.onDark }}><IconChat size={24} /></span>
                      <div>
                        <p className="font-bold text-[14px]" style={{ color: COLORS.onDark }}>Tu bot de WhatsApp</p>
                        <p className="text-[12.5px]" style={{ color: COLORS.onDarkSoft }}>Es el botón redondo del medio, abajo de todo — contale un gasto hablando y listo, sin abrir la app.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentKey === 'comoConocio' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Una última curiosidad: ¿cómo conociste FINA?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    {COMO_CONOCIO.map((o) => (
                      <Chip key={o.id} on={comoConocio === o.id} onClick={() => setComoConocio(o.id)}>{o.label}</Chip>
                    ))}
                    <OtroChip abierto={comoConocio === 'otro'} onClick={() => setComoConocio('otro')} />
                  </div>
                </>
              )}

              {currentKey === 'terminos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Antes de seguir</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Tus datos son privados — solo se usan para darte recomendaciones a vos. Nunca los compartimos ni los vendemos.</p>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={aceptoTerminos}
                    onClick={() => setAceptoTerminos((v) => !v)}
                    className="v2-focus flex items-center gap-3 text-left rounded-2xl p-4 transition-all duration-100 active:scale-[0.99]"
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: aceptoTerminos ? COLORS.brand : 'transparent', border: aceptoTerminos ? 'none' : `2px solid ${COLORS.lineStrong}` }}
                    >
                      {aceptoTerminos && <CheckIcon />}
                    </span>
                    <span className="text-[13.5px] font-medium" style={{ color: COLORS.ink }}>
                      Acepto los <span className="underline font-semibold">términos y condiciones</span> y la <span className="underline font-semibold">política de privacidad</span>.
                    </span>
                  </button>
                </>
              )}

              {currentKey === 'login' && !finished && pasoLogin === 'datos' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Guardá tu progreso</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todos los meses vas a poder ver cómo venís.</p>
                  <Campo label="Mail" error={intentoLogin && !emailOk ? (email.trim() ? 'Ese mail no parece válido' : 'Campo obligatorio') : undefined}>
                    <input className={inputClass} style={inputStyle(intentoLogin && !emailOk)} placeholder="vos@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </Campo>
                  <Campo label="Contraseña" error={intentoLogin && !passwordOk ? 'Mínimo 8 caracteres, con una mayúscula, un número y un carácter especial' : undefined}>
                    <input type="password" className={inputClass} style={inputStyle(intentoLogin && !passwordOk)} placeholder="Elegí una contraseña segura" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </Campo>
                  <Campo label="Teléfono" error={intentoLogin && !telefonoOk ? 'Campo obligatorio' : undefined}>
                    <div className="flex gap-2">
                      <span className={`flex items-center gap-1.5 px-3 rounded-2xl text-[15px] font-semibold shrink-0 ${inputClass}`} style={inputStyle(false)}>+54</span>
                      <input
                        className={`flex-1 ${inputClass}`}
                        style={inputStyle(intentoLogin && !telefonoOk)}
                        placeholder="9 11 1234-5678"
                        inputMode="numeric"
                        value={telefono}
                        onChange={(e) => setTelefono(formatearTelefonoAr(e.target.value))}
                        autoComplete="tel-national"
                      />
                    </div>
                  </Campo>
                </>
              )}

              {currentKey === 'login' && !finished && pasoLogin === 'verificar' && (
                <>
                  <h1 className="text-[23px] font-bold" style={{ color: COLORS.ink }}>Verificá tu teléfono</h1>
                  <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Te mandamos un código a +54 {telefono || 'tu teléfono'}.</p>
                  <input aria-label="Código de verificación" className={inputClass} style={inputStyle()} placeholder="Código" inputMode="numeric" value={codigoVerif} onChange={(e) => setCodigoVerif(e.target.value)} />
                  <p className="text-[12px]" style={{ color: COLORS.inkFaint }}>Modo de prueba: todavía no mandamos SMS de verdad — escribí cualquier código de 4 a 6 dígitos.</p>
                </>
              )}

              {currentKey === 'login' && finished && (
                <>
                  <div className="flex justify-center py-2"><Face color={FACE_COLOR} mood="happy" /></div>
                  <h1 className="text-[23px] font-bold text-center" style={{ color: COLORS.ink }}>¡Llegaste a FINA, {nombre.trim().split(' ')[0]}!</h1>
                  <p className="text-[14px] text-center" style={{ color: COLORS.inkSoft }}>Ya está — a partir de ahora, te acompañamos en esto.</p>
                </>
              )}
            </motion.div>
        </div>

        <div className="px-[22px] pt-2.5 pb-6 flex flex-col gap-1.5 w-full lg:max-w-xl lg:mx-auto lg:pb-10">
          <Cta label={ctaLabel} disabled={!finished && currentKey !== 'login' && !stepValid(currentKey)} onClick={onNext} />
          {!finished && SKIPPABLE.includes(currentKey) && (
            <button type="button" onClick={onSkip} className="v2-focus text-[13.5px] font-semibold underline py-2 text-center" style={{ color: COLORS.inkSoft }}>
              Saltar por ahora
            </button>
          )}
        </div>
      </div>
    </DeviceFrame>
  );
}

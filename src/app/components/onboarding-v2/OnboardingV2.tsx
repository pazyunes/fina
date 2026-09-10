import { useEffect, useMemo, useRef, useState } from 'react';
import { Fini } from './Fini';
import { useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  COLORS, DeviceFrame, CheckIcon, Chip, OtroChip, Nota, Cta,
  Titulo, Apoyo, Contador, OpcionesGrid, OpcionesLista, OpcionesMulti, BotonFantasma,
  formatThousands, parseMoneyInput,
  saveV2Categorias, saveV2Nombre,
  saveV2PerfilOnboarding, saveV2TerminosAceptados,
  saveV2InversionesPerfil, marcarFiniAterriza,
} from './shared';
import { IconChat, IconChevron, IconBasura } from './FinaIcons';
import { useAuth } from '../../lib/auth';
import { formatearTelefonoAr, telefonoE164, telefonoValidoAr } from '../../lib/telefono';
import { crearObjetivo, crearSeccion, guardarPerfil, guardarPerfilInversor } from '../../api/v2';
import { esperarCola } from '../../api/v2/almacen';

// Onboarding v2 — el flujo de entrada real.
//
// Al final de este flujo se CREA la cuenta en Supabase y se guardan las
// respuestas contra la base. localStorage sigue existiendo, pero como copia de
// trabajo de la sesión, no como el único lugar donde vive el dato. TONO: ninguna pregunta pide un monto ni una cifra exacta — todo
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

// Los ids se separan del "puede estar sin contestar" para que los componentes
// de opción (OpcionesGrid/OpcionesLista) reciban una unión de strings limpia.
type GeneroId = 'femenino' | 'masculino' | 'otro' | 'prefiero_no_decir';
type EdadId = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
type SituacionId = 'trabaja' | 'estudia' | 'ambas' | 'ninguna';
type Genero = GeneroId | null;
type Edad = EdadId | null;
type Situacion = SituacionId | null;
type ObjetivoId = 'invertir' | 'ahorrar' | 'objetivo' | 'no_claro';
type ComoVieneId = 'justo' | 'sobra' | 'no_llega' | 'hago_lo_que_quiero' | 'no_lo_tengo_en_cuenta' | 'prefiero_no_decir' | 'otro';
type Nivel = 'nada' | 'poco' | 'bastante' | 'todo';
// 'datos' → escribe mail/contraseña/teléfono · 'confirmar' → Supabase pidió
// confirmar el mail antes de dar sesión.
//
// NO hay paso de "verificar el teléfono": mandar SMS todavía no está armado, y
// una pantalla que acepta cualquier código de 4 dígitos no verifica nada — sólo
// le hace creer a la persona que su teléfono quedó validado. El teléfono se
// pide igual porque el bot lo necesita, pero se guarda como declarado.
type PasoLogin = 'datos' | 'confirmar';

// DIRECCIÓN C — una pregunta por pantalla. `generoEdad` se partió en `genero` +
// `edad` y `perfilInversor` en `invReaccion` + `invYaInvierte`: eran las dos
// pantallas que metían dos preguntas con dos <h1> del mismo tamaño, o sea sin
// jerarquía posible entre ellas.
type StepKey =
  | 'intro' | 'nombre' | 'genero' | 'edad' | 'objetivo' | 'situacion' | 'zona'
  | 'ingresos' | 'estabilidadIngresos' | 'tedioso'
  | 'invReaccion' | 'invYaInvierte' | 'objetivoInversion' | 'definirObjetivo'
  | 'intermedia' | 'comoConocio' | 'terminos' | 'login';

const CTA_LABELS: Record<StepKey, string> = {
  intro: 'Empezar',
  nombre: 'Continuar',
  genero: 'Continuar',
  edad: 'Continuar',
  objetivo: 'Continuar',
  situacion: 'Continuar',
  zona: 'Continuar',
  ingresos: 'Continuar',
  estabilidadIngresos: 'Continuar',
  tedioso: 'Continuar',
  invReaccion: 'Continuar',
  invYaInvierte: 'Continuar',
  objetivoInversion: 'Continuar',
  definirObjetivo: 'Guardar objetivo',
  intermedia: 'Genial, sigamos',
  comoConocio: 'Continuar',
  terminos: 'Aceptar y continuar',
  login: 'Continuar',
};

// Pasos que se pueden saltear sin contestar. La salida deja de ser un link
// subrayado suelto debajo del CTA y pasa a ser un BotonFantasma con borde.
const SKIPPABLE: StepKey[] = [
  'zona', 'ingresos', 'estabilidadIngresos', 'comoConocio',
];

// Pasos de OPCIÓN ÚNICA que avanzan solos al tocar la respuesta. Es lo que
// elimina el "Continuar" huérfano flotando abajo — que era la mitad de lo que
// se veía mal en el flujo viejo.
//
// Quedan afuera a propósito los pasos donde la respuesta dispara una devolución
// que hay que poder leer: `objetivo` (la burbuja "modo ahorro activado") y
// `tedioso` (la explicación del bot de WhatsApp). Ahí el CTA se queda, porque
// avanzar solo se comería el mensaje.
const AUTO_AVANCE: StepKey[] = [
  'genero', 'edad', 'situacion', 'zona', 'estabilidadIngresos',
  'invReaccion', 'invYaInvierte', 'objetivoInversion', 'comoConocio',
];

// Pasos que cuentan para el contador "Pregunta N de M" — los de trámite
// (intro, intermedia, términos, login) no son preguntas y no suman.
const NO_ES_PREGUNTA: StepKey[] = ['intro', 'intermedia', 'terminos', 'login'];

const GENEROS: { id: GeneroId; label: string; muted?: boolean }[] = [
  { id: 'femenino', label: 'Femenino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'otro', label: 'Otro' },
  { id: 'prefiero_no_decir', label: 'Prefiero no decir', muted: true },
];

const EDADES: { id: EdadId; label: string }[] = [
  { id: '18-24', label: '18 a 24' },
  { id: '25-34', label: '25 a 34' },
  { id: '35-44', label: '35 a 44' },
  { id: '45-54', label: '45 a 54' },
  { id: '55-64', label: '55 a 64' },
  { id: '65+', label: '65 o más' },
];

// Texto puro, sin emoji como marcador de opción (§2, §5.4). El chip ya es
// texto — la opción se distingue por la palabra, no por un pictograma.
const SITUACIONES: { id: SituacionId; label: string }[] = [
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

type FilaAsignacion = { id: 'ahorro' | 'inversiones' | 'gastosFijos' | 'gastosVariables'; titulo: string; ejemplo: string };
// Sí/No como opciones de verdad y no dos chips sueltos: así entran en la misma
// grilla que el resto y tienen el mismo target táctil.
const SI_NO: { id: 'si' | 'no'; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'no', label: 'No' },
];

const REACCIONES_INVERSION: { id: string; label: string }[] = [
  { id: 'Lo saco todo', label: 'Lo saco todo' },
  { id: 'Lo dejo y espero', label: 'Lo dejo y espero' },
  { id: 'Pongo más', label: 'Pongo más' },
];

const YA_INVIERTE: { id: 'si' | 'no'; label: string }[] = [
  { id: 'si', label: 'Sí, ya invierto' },
  { id: 'no', label: 'Todavía no' },
];

const PLAZOS_INVERSION: { id: string; label: string }[] = [
  { id: 'Sacarla pronto (corto plazo)', label: 'Sacarla pronto (corto plazo)' },
  { id: 'Dejarla que rinda (largo plazo)', label: 'Dejarla que rinda (largo plazo)' },
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
const inputClass = 'v2-focus rounded-2xl px-4 py-3 text-[18px] outline-none transition-colors';
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

// Las opciones fijas van en lista de ancho completo; lo que la persona escribió
// a mano sigue como chip, porque ahí sí importa que se vea como algo agregado
// por ella y que se pueda quitar de a uno.
function MultiOtroChips({ opciones, seleccion, toggle, otro }: { opciones: OpcionMulti[]; seleccion: string[]; toggle: (v: string) => void; otro: OtroMulti }) {
  return (
    <div className="flex flex-col gap-2.5">
      <OpcionesMulti opciones={opciones} seleccion={seleccion} onToggle={toggle} />
      <div className="flex flex-wrap gap-2.5">
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

// Los mensajes de Supabase vienen en inglés y en jerga ("User already
// registered"). Los que se pueden anticipar se traducen a algo accionable; el
// resto se muestra tal cual, porque un mensaje raro es más útil que un
// "algo salió mal" que no dice nada.
function traducirErrorAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ya hay una cuenta con ese mail. Podés iniciar sesión.';
  }
  if (m.includes('duplicate') && m.includes('phone')) {
    return 'Ese teléfono ya está usado por otra cuenta.';
  }
  if (m.includes('invalid email')) return 'Ese mail no parece válido.';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No pudimos conectarnos. Fijate la conexión y probá otra vez.';
  }
  return msg;
}

function emailValido(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function passwordValida(v: string) { return v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v); }
// El teléfono se normaliza y valida en src/app/lib/telefono.ts, que es el mismo
// archivo que usa el login viejo. Tiene que ser UNA sola regla: es la llave con
// la que el bot de WhatsApp encuentra a la persona.

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[15px] font-semibold" style={{ color: COLORS.inkSoft }}>{label}</label>
      {children}
      {error && <p className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}
    </div>
  );
}

export function OnboardingV2() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
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
  const [creando, setCreando] = useState(false);
  const [errorAuth, setErrorAuth] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = [
      'intro', 'nombre', 'genero', 'edad', 'objetivo', 'situacion', 'zona',
      'ingresos', 'estabilidadIngresos', 'tedioso',
    ];
    // Ramas según lo que quiere lograr:
    if (meta === 'invertir') f.push('invReaccion', 'invYaInvierte', 'objetivoInversion');
    else if (meta === 'objetivo') f.push('definirObjetivo');
    // 'ahorrar' y 'no_claro' siguen el flujo normal, sin pasos extra.
    f.push('intermedia', 'comoConocio', 'terminos', 'login');
    return f;
  }, [meta]);
  const currentKey = flow[Math.min(currentIdx, flow.length - 1)];

  // Contador "Pregunta N de M": se cuenta sobre las preguntas reales del flujo
  // actual, no sobre todos los pasos. Como el flujo se ramifica según `meta`,
  // el total se recalcula solo cuando la rama cambia.
  const preguntas = useMemo(() => flow.filter((k) => !NO_ES_PREGUNTA.includes(k)), [flow]);
  const preguntaActual = preguntas.indexOf(currentKey) + 1;
  const esPregunta = preguntaActual > 0;

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

  const telefonoOk = telefonoValidoAr(telefono);
  const emailOk = emailValido(email);
  const passwordOk = passwordValida(password);

  function stepValid(key: StepKey): boolean {
    if (key === 'nombre') return nombre.trim().length > 0;
    if (key === 'genero') return !!genero && (genero !== 'otro' || generoOtroTxt.trim().length > 0);
    if (key === 'edad') return !!edad;
    if (key === 'objetivo') return !!meta;
    if (key === 'situacion') return !!situacion;
    if (key === 'invReaccion') return !!invReaccion;
    if (key === 'invYaInvierte') return !!invYaInvierte;
    if (key === 'objetivoInversion') return !!invPorQue;
    if (key === 'definirObjetivo') return objNombre.trim().length > 0 && parseMoneyInput(objMonto) > 0;
    if (key === 'terminos') return aceptoTerminos;
    if (key === 'login') return emailOk && passwordOk && telefonoOk;
    return true;
  }

  function resuelto(valor: string | null, txt: string): string | null {
    if (valor === 'otro') return txt.trim() || null;
    return valor;
  }

  // Las respuestas que la app lee en bloque y nunca filtra. Van a
  // user_profiles.onboarding_v2 (jsonb) — ver la migración 0024.
  function armarOnboarding() {
    return {
      situacion,
      gastosFijos: [...gastosFijos, ...gastosFijosOtro.custom],
      categoriasRecortar: recortarNinguna ? [] : categoriasRecortarSel,
      asignacion,
      tedioso,
      comoViene,
      comoVieneOtro: comoVieneOtroTxt.trim() || null,
      categoriasGasto: categoriasElegidas,
    };
  }

  // Sube TODO lo que se contestó a Supabase. Corre después de crear la cuenta,
  // porque hasta que no hay sesión no hay `auth.uid()` y ninguna policy deja
  // escribir. Devuelve el primer error que aparezca: si el perfil no se
  // guardó, la persona tiene que enterarse antes de entrar a una app que va a
  // mostrarle su nombre en blanco.
  async function guardarEnSupabase(): Promise<string | null> {
    const perfil = await guardarPerfil({
      nombre: nombre.trim(),
      genero: genero,
      generoOtro: genero === 'otro' ? (generoOtroTxt.trim() || null) : null,
      rangoEdad: edad,
      zona,
      convivencia: [...convivencia, ...convivenciaOtro.custom],
      ingresos: [...ingresos, ...ingresosOtro.custom],
      estabilidadIngresos: resuelto(estabilidadIngresos, estabilidadOtroTxt),
      metaPrincipal: meta,
      comoConocio: resuelto(comoConocio, comoConocioOtroTxt),
      telefono: telefonoE164(telefono) || null,
      terminosAceptadosEn: aceptoTerminos ? new Date().toISOString() : null,
      onboarding: armarOnboarding(),
    });
    if (perfil.error) return perfil.error;

    // Las secciones de gasto que eligió se crean como filas: son las que le van
    // a aparecer en Gastos sin que tenga que escribirlas de nuevo.
    for (const nombreSeccion of categoriasElegidas) {
      const r = await crearSeccion(nombreSeccion);
      if (r.error) return r.error;
    }

    if (meta === 'invertir' && invReaccion && invPorQue) {
      const r = await guardarPerfilInversor({
        porQue: invPorQue,
        reaccion: invReaccion,
        yaInvierte: invYaInvierte === null ? null : invYaInvierte === 'si',
        enQue: [],
        bancos: [],
        // El quiz completo se hace en la pantalla de Inversiones: acá sólo se
        // contestaron dos preguntas.
        completadoEn: null,
      });
      if (r.error) return r.error;
    }

    if (meta === 'objetivo' && objNombre.trim() && parseMoneyInput(objMonto) > 0) {
      const r = await crearObjetivo({
        nombre: objNombre.trim(),
        tipo: 'individual',
        moneda: objMoneda,
        horizonte: horizonteDelObjetivo(),
        montoTotal: parseMoneyInput(objMonto),
      });
      if (r.error) return r.error;
    }

    await esperarCola();
    return null;
  }

  function horizonteDelObjetivo(): string {
    return objFecha
      ? new Date(objFecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Lo antes posible';
  }

  // Copia local. Es lo que hace que Home/Gastos pinten al instante al terminar
  // el onboarding, sin esperar la primera lectura contra la base.
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

    // Rama "Objetivo puntual": el objetivo se crea como fila en `goals` dentro
    // de `guardarEnSupabase`, no acá. Antes viajaba por localStorage hasta la
    // pantalla de Objetivos, así que existía sólo en ese navegador.
  }

  // ── Auto-avance ───────────────────────────────────────────────────────
  // Al tocar una respuesta de opción única, la pantalla avanza sola. El delay
  // existe para que se llegue a VER el estado elegido: sin él la opción se
  // pinta y desaparece en el mismo frame, y no queda claro qué se eligió.
  // Con `prefers-reduced-motion` no hace falta esa espera visual, así que
  // avanza al toque.
  const reduce = useReducedMotion();
  const autoTimer = useRef<number | null>(null);
  useEffect(() => () => { if (autoTimer.current !== null) window.clearTimeout(autoTimer.current); }, []);

  function avanzar() {
    setCurrentIdx((i) => Math.min(i + 1, flow.length - 1));
  }

  // `avanzaSolo` es false cuando la respuesta abre un campo de texto ("Otro"):
  // ahí hay que quedarse para poder escribir.
  function elegir<T>(set: (v: T) => void, valor: T, avanzaSolo = true) {
    set(valor);
    if (!avanzaSolo || !AUTO_AVANCE.includes(currentKey)) return;
    if (autoTimer.current !== null) window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(avanzar, reduce ? 0 : 190);
  }

  // El CTA sobrevive solo donde hace falta: pasos que no avanzan solos, o pasos
  // que sí lo harían pero quedaron esperando un "Otro" escrito a mano.
  const esperandoOtro =
    (currentKey === 'genero' && genero === 'otro') ||
    (currentKey === 'estabilidadIngresos' && estabilidadIngresos === 'otro') ||
    (currentKey === 'comoConocio' && comoConocio === 'otro');
  const pideCta = !AUTO_AVANCE.includes(currentKey) || esperandoOtro;

  // Crea la cuenta de verdad y sube las respuestas. Antes esta pantalla no
  // creaba nada: aceptaba cualquier código y seguía. Ahora, si Supabase
  // rechaza el mail o el teléfono, la persona se queda acá y ve por qué.
  async function crearCuenta() {
    if (creando) return;
    setCreando(true);
    setErrorAuth(null);

    const { error, needsConfirmation } = await signUp(email.trim(), password, telefonoE164(telefono));
    if (error) {
      setErrorAuth(traducirErrorAuth(error));
      setCreando(false);
      return;
    }

    // Sin sesión todavía: Supabase pide confirmar el mail. Las respuestas no se
    // pueden subir ahora (no hay auth.uid()), así que quedan en la copia local
    // y se suben cuando entre. Se le dice, no se le esconde.
    if (needsConfirmation) {
      guardarTodo();
      setPasoLogin('confirmar');
      setCreando(false);
      return;
    }

    guardarTodo();
    const errorGuardado = await guardarEnSupabase();
    setCreando(false);
    if (errorGuardado) { setErrorAuth(`Tu cuenta se creó, pero no pudimos guardar tus respuestas: ${errorGuardado}`); return; }
    setFinished(true);
  }

  function onNext() {
    if (currentKey === 'login') {
      if (finished) { marcarFiniAterriza(); navigate('/onboarding-v2/home'); return; }
      if (pasoLogin === 'confirmar') { navigate('/login'); return; }
      setIntentoLogin(true);
      if (!stepValid('login')) return;
      void crearCuenta();
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

  // Una sola barra continua, no cuatro segmentos por sección. Los segmentos
  // decían en qué bloque estabas pero nunca cuánto faltaba en total; el
  // contador de arriba ya dice el bloque, así que la barra puede decir el resto.
  const progresoPct = Math.round(((currentIdx + 1) / flow.length) * 100);

  const ctaLabel = finished
    ? 'Ir a mi FINA'
    : currentKey === 'login'
      ? (creando ? 'Creando tu cuenta…' : pasoLogin === 'confirmar' ? 'Ir a iniciar sesión' : 'Crear mi cuenta')
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
      {/* Un solo fondo para todo el flujo. Antes cada sección tenía el suyo
          (tinte, star suave, lila), pero como los tres estaban entre 1.11 y
          1.20 de contraste, el cambio no se percibía: solo ensuciaba. Dónde
          estás lo dice ahora el contador, que además dice cuánto falta. */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ background: COLORS.paper }}>
        {showTop && (
          <header className="px-6 pt-5 pb-1 flex items-center gap-3 w-full lg:max-w-xl lg:mx-auto lg:pt-10">
            <button type="button" onClick={onBack} aria-label="Volver a la pregunta anterior" className="v2-focus shrink-0 w-11 h-11 -ml-2.5 flex items-center justify-center rounded-full transition-all duration-100 active:scale-90" style={{ color: COLORS.ink }}>
              <IconChevron size={22} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div className="flex-1 flex flex-col gap-1.5">
              {esPregunta && <Contador actual={preguntaActual} total={preguntas.length} />}
              <div
                className="h-[4px] rounded-full overflow-hidden"
                style={{ background: COLORS.line }}
                role="progressbar"
                aria-valuenow={progresoPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progreso del onboarding"
              >
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progresoPct}%`, background: COLORS.brand }} />
              </div>
            </div>
          </header>
        )}

        {/* DISTRIBUCIÓN — el arreglo del vacío del 60%.
            El contenido estaba pegado arriba y el CTA al fondo, así que en una
            pantalla con cuatro opciones quedaba medio celular vacío en el medio.
            `my-auto` en el hijo lo centra ópticamente cuando sobra lugar y no
            hace nada cuando el contenido es más alto que el viewport (ahí
            scrollea normal, sin recortar por arriba como haría `justify-center`).
            El `pb` extra empuja el bloque un poco sobre el centro geométrico:
            el centro óptico está más arriba que el matemático. */}
        <div className="flex-1 min-h-0 flex flex-col px-6 pt-7 pb-4 overflow-y-auto w-full lg:max-w-xl lg:mx-auto">
          <motion.div
              key={finished ? 'finished' : currentKey}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
              aria-live="polite"
              className="flex flex-col gap-5 my-auto w-full pb-[12vh]"
            >
              {currentKey === 'intro' && (
                <>
                  <div className="flex justify-center pb-1"><Fini state="saludo" size={132} /></div>
                  <Titulo>
                    Llegó tu momento de cambiar la historia de tus finanzas
                  </Titulo>
                  {/* Sin caja. Tres promesas no necesitan un contenedor para
                      leerse como grupo: el aire y la repetición del check ya
                      las agrupan. La caja anterior tenía 1.07 de contraste
                      contra el papel, o sea que no agrupaba nada — solo sumaba
                      un borde más a la pantalla. */}
                  <ul className="flex flex-col gap-3.5 list-none p-0 m-0">
                    {['Conocé tus gastos', 'Lográ tus objetivos', 'Cuidá tu bienestar financiero'].map((txt) => (
                      <li key={txt} className="flex items-center gap-3 text-[20px] font-semibold" style={{ color: COLORS.ink }}>
                        <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brand }}>
                          <CheckIcon />
                        </span>
                        {txt}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[18px]" style={{ color: COLORS.inkSoft }}>Todo esto, a tu ritmo — no hace falta que sepas nada todavía.</p>
                </>
              )}

              {currentKey === 'nombre' && (
                <>
                  <Titulo>¿Cómo te llamamos?</Titulo>
                  <Apoyo>Así te vamos a hablar de acá en adelante.</Apoyo>
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

              {/* Antes esta pantalla y la de edad eran una sola, con dos <h1>
                  del mismo tamaño: no había forma de jerarquizarlas. Ahora son
                  dos, y cada una entra completa sin scroll. Las cuatro opciones
                  llenan exactamente una grilla de 2×2 — sin wrap ragged. */}
              {currentKey === 'genero' && (
                <>
                  <Titulo>¿Con qué género te identificás?</Titulo>
                  <OpcionesGrid
                    opciones={GENEROS}
                    valor={genero}
                    onElegir={(id) => elegir(setGenero, id, id !== 'otro')}
                  />
                  {genero === 'otro' && (
                    <input autoFocus aria-label="Contanos cómo te identificás" className={inputClass} style={inputStyle()} placeholder="Contanos cómo te identificás" value={generoOtroTxt} onChange={(e) => setGeneroOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {currentKey === 'edad' && (
                <>
                  <Titulo>¿Qué edad tenés?</Titulo>
                  <OpcionesGrid opciones={EDADES} valor={edad} onElegir={(id) => elegir(setEdad, id)} />
                </>
              )}

              {currentKey === 'objetivo' && (
                <>
                  <Titulo>¿Qué es lo que más querés lograr con tu plata?</Titulo>
                  <Apoyo>Elegí la que mejor te represente hoy — después vas a poder hacer todo lo demás igual.</Apoyo>
                  <OpcionesLista opciones={OBJETIVOS} valor={meta} onElegir={setMeta} />
                  <div className="flex justify-center py-1"><Fini state="idle" size={104} /></div>
                  {meta && (
                    <div className="self-center max-w-[82%] text-center rounded-2xl px-4 py-3 text-[15px] font-semibold" style={{ color: COLORS.ink, background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
                      {objetivoBubble}
                    </div>
                  )}
                </>
              )}

              {currentKey === 'situacion' && (
                <>
                  <Titulo>Contanos, ¿en qué andás?</Titulo>
                  <OpcionesGrid opciones={SITUACIONES} valor={situacion} onElegir={(id) => elegir(setSituacion, id)} />
                </>
              )}

              {currentKey === 'zona' && (
                <>
                  <Titulo>¿En dónde andás viviendo?</Titulo>
                  <OpcionesGrid opciones={ZONAS} valor={zona} onElegir={(id) => elegir(setZona, id)} />
                </>
              )}

              {currentKey === 'ingresos' && (
                <>
                  <Titulo>¿De dónde vienen tus ingresos hoy?</Titulo>
                  <Nota>Esto es solo tuyo — nadie más lo ve. Elegí todas las que apliquen.</Nota>
                  <MultiOtroChips opciones={INGRESOS_OPCIONES.map((v) => ({ value: v, display: v }))} seleccion={ingresos} toggle={toggleIngresos} otro={ingresosOtro} />
                </>
              )}

              {currentKey === 'estabilidadIngresos' && (
                <>
                  <Titulo>¿Con qué regularidad recibís tus ingresos?</Titulo>
                  <OpcionesLista
                    opciones={ESTABILIDAD}
                    valor={estabilidadIngresos}
                    onElegir={(id) => elegir(setEstabilidadIngresos, id)}
                  />
                  <OtroChip abierto={estabilidadIngresos === 'otro'} onClick={() => setEstabilidadIngresos('otro')} />
                  {estabilidadIngresos === 'otro' && (
                    <input autoFocus aria-label="Contanos más sobre tus ingresos" className={inputClass} style={inputStyle()} placeholder="Contanos más" value={estabilidadOtroTxt} onChange={(e) => setEstabilidadOtroTxt(e.target.value)} />
                  )}
                </>
              )}

              {currentKey === 'tedioso' && (
                <>
                  <Titulo>¿Se te hace tedioso llevar el control de tu plata?</Titulo>
                  <OpcionesGrid opciones={SI_NO} valor={tedioso} onElegir={setTedioso} />
                  {tedioso && (
                    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.ink }}>
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.darkLine, color: COLORS.onDark }}><IconChat size={24} /></span>
                        <div className="flex flex-col">
                          <p className="text-[18px] font-bold" style={{ color: COLORS.onDark }}>
                            {tedioso === 'si' ? 'Tranqui — para eso está tu FINA en WhatsApp' : 'Igual te va a encantar tu FINA en WhatsApp'}
                          </p>
                          <p className="text-[14px]" style={{ color: COLORS.onDarkSoft }}>Sin planillas, sin abrir la app.</p>
                        </div>
                      </div>
                      <p className="text-[15px] leading-relaxed" style={{ color: COLORS.onDark }}>
                        Le escribís tu gasto como se lo contarías a una amiga —{' '}
                        <span className="font-semibold" style={{ color: COLORS.onDark }}>“gasté 5.000 en el súper”</span>{' '}
                        — y FINA lo registra sola, al toque. También te responde dudas y te avisa cómo venís.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* El perfil de inversor también era una sola pantalla con dos
                  preguntas — y encima la primera es un escenario que hay que
                  leer entero antes de contestar. Partida en dos, el escenario
                  puede ocupar el título sin competir con nada. */}
              {currentKey === 'invReaccion' && (
                <>
                  <Titulo>Estás en una inversión que sube y baja, pero promete crecer a 5 años. ¿Qué hacés?</Titulo>
                  <Apoyo>Nunca movemos tu plata — esto es solo para recomendarte según vos.</Apoyo>
                  <OpcionesLista
                    opciones={REACCIONES_INVERSION}
                    valor={invReaccion}
                    onElegir={(id) => elegir(setInvReaccion, id)}
                  />
                </>
              )}

              {currentKey === 'invYaInvierte' && (
                <>
                  <Titulo>¿Ya invertís hoy en algo?</Titulo>
                  <OpcionesGrid
                    opciones={YA_INVIERTE}
                    valor={invYaInvierte}
                    onElegir={(id) => elegir(setInvYaInvierte, id)}
                  />
                </>
              )}

              {currentKey === 'objetivoInversion' && (
                <>
                  <Titulo>¿Con qué objetivo querés invertir esa plata?</Titulo>
                  <Apoyo>Con esto afinamos qué opciones tienen más sentido para vos.</Apoyo>
                  <OpcionesLista
                    opciones={PLAZOS_INVERSION}
                    valor={invPorQue}
                    onElegir={(id) => elegir(setInvPorQue, id)}
                  />
                </>
              )}

              {currentKey === 'definirObjetivo' && (
                <>
                  <Titulo>¿Cuál es ese objetivo?</Titulo>
                  <Apoyo>Lo dejamos cargado y ya lo vas a ver con su progreso apenas entres.</Apoyo>
                  <input autoFocus aria-label="Nombre de tu objetivo" className={inputClass} style={inputStyle()} placeholder="Ej: Viaje a Bariloche" value={objNombre} onChange={(e) => setObjNombre(e.target.value)} />
                  <div className="flex items-center justify-between">
                    <p className="text-[16px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
                    <div className="flex rounded-full p-0.5" style={{ background: COLORS.tint }}>
                      {(['ARS', 'USD'] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={objMoneda === m} onClick={() => setObjMoneda(m)} className="v2-focus rounded-full px-3 py-1 text-[14px] font-bold transition-colors" style={objMoneda === m ? { background: COLORS.brand, color: COLORS.surface } : { color: COLORS.inkSoft }}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{objMoneda === 'USD' ? 'US$' : '$'}</span>
                    <input aria-label="Monto total del objetivo" className={`${inputClass} pl-11`} style={inputStyle()} placeholder="Monto total" inputMode="decimal" value={objMonto} onChange={(e) => setObjMonto(formatThousands(e.target.value))} />
                  </div>
                  <p className="text-[16px] font-bold mt-1" style={{ color: COLORS.ink }}>¿Para cuándo? <span className="font-normal text-[15px]" style={{ color: COLORS.inkSoft }}>(opcional)</span></p>
                  <input type="date" aria-label="Fecha del objetivo (opcional)" className={inputClass} style={inputStyle()} value={objFecha} onChange={(e) => setObjFecha(e.target.value)} />
                </>
              )}

              {currentKey === 'intermedia' && (
                <>
                  <div className="flex justify-center pb-1"><Fini state="insight" size={120} /></div>
                  <Titulo>{meta === 'invertir' ? 'Tu plata, lista para crecer' : meta === 'ahorrar' ? 'Tu ahorro, siempre a la vista' : meta === 'objetivo' ? '¡Tu objetivo ya está en marcha!' : 'Así se va a ir viendo tu FINA'}</Titulo>
                  <Apoyo>{meta === 'invertir' ? 'Con tu perfil listo, esto es lo que te espera adentro.' : meta === 'ahorrar' ? 'Esto es lo que vas a poder hacer para que te sobre cada vez más.' : meta === 'objetivo' ? 'Lo vas a ver con su progreso, y todo esto además.' : 'Todo lo que FINA va a hacer por vos.'}</Apoyo>
                  <div className="flex flex-col gap-3">
                    {previewsOrdenados.map((p) => (
                      <div key={p.titulo} className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: p.bg }}>
                        <div>
                          <p className="font-bold text-[16px]" style={{ color: COLORS.ink }}>{p.titulo}</p>
                          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{p.desc}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background: COLORS.ink }}>
                      <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.darkLine, color: COLORS.onDark }}><IconChat size={24} /></span>
                      <div>
                        <p className="font-bold text-[16px]" style={{ color: COLORS.onDark }}>Tu bot de WhatsApp</p>
                        <p className="text-[14px]" style={{ color: COLORS.onDarkSoft }}>Es el botón redondo del medio, abajo de todo — contale un gasto hablando y listo, sin abrir la app.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentKey === 'comoConocio' && (
                <>
                  <Titulo>Una última curiosidad: ¿cómo conociste FINA?</Titulo>
                  <OpcionesGrid
                    opciones={COMO_CONOCIO}
                    valor={comoConocio}
                    onElegir={(id) => elegir(setComoConocio, id)}
                  />
                  <OtroChip abierto={comoConocio === 'otro'} onClick={() => setComoConocio('otro')} />
                </>
              )}

              {currentKey === 'terminos' && (
                <>
                  <Titulo>Antes de seguir</Titulo>
                  <Apoyo>Tus datos son privados — solo se usan para darte recomendaciones a vos. Nunca los compartimos ni los vendemos.</Apoyo>
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
                    <span className="text-[15px] font-medium" style={{ color: COLORS.ink }}>
                      Acepto los <span className="underline font-semibold">términos y condiciones</span> y la <span className="underline font-semibold">política de privacidad</span>.
                    </span>
                  </button>
                </>
              )}

              {currentKey === 'login' && !finished && pasoLogin === 'datos' && (
                <>
                  <Titulo>Guardá tu progreso</Titulo>
                  <Apoyo>Todos los meses vas a poder ver cómo venís.</Apoyo>
                  <Campo label="Mail" error={intentoLogin && !emailOk ? (email.trim() ? 'Ese mail no parece válido' : 'Campo obligatorio') : undefined}>
                    <input className={inputClass} style={inputStyle(intentoLogin && !emailOk)} placeholder="vos@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </Campo>
                  <Campo label="Contraseña" error={intentoLogin && !passwordOk ? 'Mínimo 8 caracteres, con una mayúscula, un número y un carácter especial' : undefined}>
                    <input type="password" className={inputClass} style={inputStyle(intentoLogin && !passwordOk)} placeholder="Elegí una contraseña segura" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  </Campo>
                  <Campo label="Teléfono" error={intentoLogin && !telefonoOk ? 'Campo obligatorio' : undefined}>
                    <div className="flex gap-2">
                      <span className={`flex items-center gap-1.5 px-3 rounded-2xl text-[18px] font-semibold shrink-0 ${inputClass}`} style={inputStyle(false)}>+54</span>
                      <input
                        className={`flex-1 ${inputClass}`}
                        style={inputStyle(intentoLogin && !telefonoOk)}
                        placeholder="11 1234-5678"
                        inputMode="numeric"
                        value={telefono}
                        onChange={(e) => setTelefono(formatearTelefonoAr(e.target.value))}
                        autoComplete="tel-national"
                      />
                    </div>
                  </Campo>
                  <p className="text-[14px]" style={{ color: COLORS.inkFaint }}>
                    Te lo pedimos para que puedas registrar gastos por WhatsApp. Todavía no lo verificamos con un SMS.
                  </p>
                  {errorAuth && (
                    <p role="alert" className="text-[15px] font-semibold" style={{ color: COLORS.coralDark }}>{errorAuth}</p>
                  )}
                </>
              )}

              {currentKey === 'login' && !finished && pasoLogin === 'confirmar' && (
                <>
                  <Titulo>Confirmá tu mail</Titulo>
                  <Apoyo>Te mandamos un mail a {email.trim()}. Tocá el link y volvé a entrar: tus respuestas ya quedaron guardadas.</Apoyo>
                </>
              )}

              {currentKey === 'login' && finished && (
                <>
                  <div className="flex justify-center py-2"><Fini state="logro" size={150} /></div>
                  <Titulo>¡Llegaste a FINA, {nombre.trim().split(' ')[0]}!</Titulo>
                  <p className="text-[16px] text-center" style={{ color: COLORS.inkSoft }}>Ya está — a partir de ahora, te acompañamos en esto.</p>
                </>
              )}
            </motion.div>
        </div>

        {/* Pie. Solo existe si la pantalla lo necesita: en los pasos de opción
            única que avanzan solos no hay nada acá abajo, y ese vacío al pie
            desaparece con él. */}
        {(pideCta || (!finished && SKIPPABLE.includes(currentKey))) && (
          <div className="px-6 pt-3 pb-6 flex flex-col gap-2.5 w-full lg:max-w-xl lg:mx-auto lg:pb-10">
            {pideCta && (
              <Cta label={ctaLabel} disabled={creando || (!finished && currentKey !== 'login' && !stepValid(currentKey))} onClick={onNext} />
            )}
            {!finished && SKIPPABLE.includes(currentKey) && (
              <BotonFantasma label="Saltar por ahora" onClick={onSkip} />
            )}
          </div>
        )}
      </div>
    </DeviceFrame>
  );
}

import { useEffect, useState } from 'react';
import { ArmarGrupoBtn, COLORS, Chip, Cta, Donut, EstadoConfianza, Monto, OpcionesGrid, Rango, Tabs, Titulo, TituloSeccion, fechaDisplay, fmtMoney, formatThousands, loadV2InversionesPerfil, loadV2InversionesState, parseMoneyInput, saveV2InversionesState } from './shared';
import { IconChevron, IconClose } from './FinaIcons';
import { useDisplayCurrency, useMoney } from '../../lib/displayCurrency';
import { fetchExchangeRate } from '../../lib/exchangeRate';

// REDISEÑO v2 — Inversiones. La clave es la personalización (pedido
// explícito): un mini-quiz corto arma un perfil de riesgo real (no fijo),
// pregunta si ya invertís (y en qué) y qué bancos/billeteras usás — y con
// eso arma recomendaciones que tienen en cuenta lo que ya hacés y desde
// dónde lo podés hacer. Mismo catálogo/lógica que InversionesPage.tsx de
// la app real, adaptado a este sandbox sin backend.
//
// Una vez armado el perfil, la pantalla se divide en 3 (pedido explícito):
// Recomendaciones / Mis inversiones / Mi evolución. Todo en el diseño CLARO
// de FINA (blanco + violeta), coherente con el resto de la app.

type Paso = 'intro' | 'q1' | 'q2' | 'yaInvierte' | 'enQue' | 'bancos' | 'resultado';
type PerfilId = 'conservador' | 'moderado' | 'arriesgado';
type Tab = 'mias' | 'recos' | 'evolucion';

const BANCOS = ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank', 'Banco tradicional', 'Efectivo', 'Otro'];
const EN_QUE_OPCIONES = ['Plazo fijo', 'Fondo común (FCI)', 'Dólar', 'CEDEARs / acciones', 'Cripto', 'Otro'];
const EN_QUE_TO_INSTRUMENTO: Record<string, string> = {
  'Plazo fijo': 'plazo_fijo',
  'Fondo común (FCI)': 'fci',
  Dólar: 'dolar_mep',
  'CEDEARs / acciones': 'cedears',
};

type Instrumento = { id: string; nombre: string; desc: string; porQue: string; riesgo: 'Bajo' | 'Medio' | 'Alto'; apps: string[]; perfiles: PerfilId[] };
const INSTRUMENTOS: Instrumento[] = [
  {
    id: 'cuenta_remunerada', nombre: 'Cuenta remunerada', desc: 'Tu plata rinde todos los días y la sacás cuando quieras.',
    porQue: 'Te la recomendamos porque no perdés acceso a la plata ni un solo día — sirve como base antes de meterte en algo más largo, y por eso la sugerimos casi sin importar tu perfil.',
    riesgo: 'Bajo', apps: ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank'], perfiles: ['conservador', 'moderado', 'arriesgado'],
  },
  {
    id: 'plazo_fijo', nombre: 'Plazo fijo UVA', desc: 'Dejás la plata quieta un tiempo y sigue la inflación.',
    porQue: 'Te la recomendamos porque, dijiste que preferís cuidar lo que tenés antes que arriesgar — esto ajusta por inflación sin que tengas que mirar el mercado todos los días.',
    riesgo: 'Bajo', apps: ['Banco tradicional', 'Mercado Pago', 'Ualá'], perfiles: ['conservador', 'moderado'],
  },
  {
    id: 'fci', nombre: 'Fondo Común de Inversión', desc: 'Un equipo profesional invierte por vos, retiro rápido.',
    porQue: 'Te la recomendamos porque buscás algo de crecimiento sin manejarlo vos misma — un equipo decide dónde poner la plata, y la podés sacar en pocos días si la necesitás.',
    riesgo: 'Medio', apps: ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank'], perfiles: ['moderado', 'arriesgado'],
  },
  {
    id: 'dolar_mep', nombre: 'Dólar MEP', desc: 'Protegés lo ahorrado de la devaluación.',
    porQue: 'Te la recomendamos porque tu prioridad parece ser no perder poder de compra frente al dólar — no crece como una inversión de riesgo, pero cuida el valor de lo que ya juntaste.',
    riesgo: 'Medio', apps: ['Banco tradicional', 'Brubank'], perfiles: ['moderado', 'arriesgado'],
  },
  {
    id: 'cedears', nombre: 'CEDEARs', desc: 'Pedacitos de empresas grandes del exterior, en pesos.',
    porQue: 'Te la recomendamos porque contestaste que te bancás la volatilidad a cambio de más potencial — subís y bajás con el mercado internacional, pero a largo plazo históricamente crece.',
    riesgo: 'Alto', apps: ['Banco tradicional'], perfiles: ['arriesgado'],
  },
];

// Sin emoji de nivel de riesgo (guía §2/§5.4: nunca un emoji, menos en un dato).
// El nivel se dice con palabra y con el relleno de la paleta, no con dibujitos.
const PERFILES: Record<PerfilId, { label: string; copy: string; tasaMensual: number }> = {
  conservador: { label: 'Conservador', copy: 'Preferís cuidar lo que tenés antes que arriesgar de más.', tasaMensual: 0.008 },
  moderado: { label: 'Moderado', copy: 'Buscás un equilibrio entre seguridad y crecimiento.', tasaMensual: 0.015 },
  arriesgado: { label: 'Arriesgado', copy: 'Te bancás más vaivén a cambio de más potencial de crecimiento.', tasaMensual: 0.025 },
};

// Tinte + texto por perfil, todo desde la paleta de la guía (§3.3): relleno
// suave de fondo + su token -Text (≥6:1) para la tipografía. Nada de hex crudo.
const PERFIL_LIGHT: Record<PerfilId, { soft: string; strong: string }> = {
  conservador: { soft: COLORS.limaSoft, strong: COLORS.limaText },
  moderado: { soft: COLORS.starSoft, strong: COLORS.starText },
  arriesgado: { soft: COLORS.naranjaSoft, strong: COLORS.naranjaText },
};

// Color de relleno por nivel de riesgo (segmentos del donut, puntos de leyenda).
// Es una distinción categórica, no un juicio: usa rellenos de la paleta en
// rampa cálida lima / star / naranja, nunca verde ni coral neón fuera de tokens.
// El nivel de riesgo, dicho en criollo. Una etiqueta que dice "Riesgo medio"
// no significa nada para alguien que nunca invirtió: nombra una categoría sin
// explicar qué le puede pasar a su plata. Estas frases dicen lo mismo en
// términos de lo que se ve, sin dramatizar y sin prometer.
const RIESGO_EXPLICADO: Record<Instrumento['riesgo'], string> = {
  Bajo: 'Lo que ponés no debería bajar. Rinde menos, pero es lo más previsible.',
  Medio: 'Puede subir y bajar en el camino. Suele acomodarse con el tiempo.',
  Alto: 'Sube y baja bastante. Es para plata que puedas dejar quieta un buen rato.',
};

const RIESGO_FILL: Record<Instrumento['riesgo'], string> = {
  Bajo: COLORS.lima,
  Medio: COLORS.star,
  Alto: COLORS.naranja,
};

type Moneda = 'ARS' | 'USD';
// Un aporte guarda TRES cosas, no una:
//   · `monto` + `moneda`: lo que la persona efectivamente cargó. Es el hecho,
//     y se muestra siempre tal cual — nunca convertido.
//   · `cotizacion`: el blue del día en que se cargó, cuando fue en USD.
//   · `montoArs`: el equivalente en pesos CONGELADO a esa cotización, que es
//     lo que se suma.
// Guardar solo el número convertido a pesos de hoy seria un bug conocido de
// esta app: está documentado en Main.tsx ("los montos en USD cargados con el
// dólar viejo se ven desfasados"). Un aporte de US$100 de hace seis meses no
// son los pesos que valen esos dólares hoy: son los que pusiste entonces.
// `moneda`, `cotizacion` y `montoArs` son opcionales para que los registros
// viejos —que solo tienen `monto` en pesos— sigan leyéndose.
type Aporte = {
  id: string;
  monto: number;
  moneda?: Moneda;
  cotizacion?: number;
  montoArs?: number;
  instrumentoId: string;
  ts: number;
};

// Lecturas tolerantes con lo ya guardado.
const monedaDe = (a: Aporte): Moneda => a.moneda ?? 'ARS';
const montoArsDe = (a: Aporte): number => a.montoArs ?? a.monto;
type PersistidoInv = {
  completado: boolean; // llegó a la pantalla de resultado alguna vez
  porQue: string | null;
  reaccion: string | null;
  yaInvierte: 'si' | 'no' | null;
  enQue: string[];
  bancos: string[];
  aportes: Aporte[];
  monedaInv?: Moneda;
};

// Tarjeta clara estándar de FINA v2. El borde va por token (hairline), no por
// el color por defecto de Tailwind, para no dejar un color fuera de la paleta.
// Única tarjeta de la pantalla: la entrada a armar el perfil.
const CARD = 'bg-white rounded-2xl border';
const cardStyle = { borderColor: COLORS.lineStrong } as const;
// Bloque de sección: sin contorno, separado por aire y por su propio título.
const BLOQUE = 'flex flex-col gap-3';

export function InversionesV2() {
  // Si ya había estado antes en esta pantalla y llegó al resultado, retoma
  // todo tal cual quedó (perfil + aportes) en vez de hacerla repetir el
  // quiz cada vez que entra. Si en el onboarding ya contestó el
  // mini-perfil, arranca directo desde "¿ya invertís?".
  const persistido = loadV2InversionesState<PersistidoInv>();
  const [prefilledPerfil] = useState(() => !!loadV2InversionesPerfil());
  const [paso, setPaso] = useState<Paso>(() => (persistido?.completado ? 'resultado' : 'intro'));
  const [porQue, setPorQue] = useState<string | null>(() => persistido?.porQue ?? loadV2InversionesPerfil()?.porQue ?? null);
  const [reaccion, setReaccion] = useState<string | null>(() => persistido?.reaccion ?? loadV2InversionesPerfil()?.reaccion ?? null);
  // "¿Invertís?" ya se contestó en el onboarding (pregunta de hábitos, con
  // más matices que un sí/no) — si esa respuesta viajó hasta acá, no se
  // repregunta de nuevo.
  const [prefilledYaInvierte] = useState(() => !!loadV2InversionesPerfil()?.yaInvierte);
  const [yaInvierte, setYaInvierte] = useState<'si' | 'no' | null>(() => persistido?.yaInvierte ?? loadV2InversionesPerfil()?.yaInvierte ?? null);
  const [enQue, setEnQue] = useState<string[]>(() => persistido?.enQue ?? []);
  const [bancos, setBancos] = useState<string[]>(() => persistido?.bancos ?? []);
  const [tab, setTab] = useState<Tab>('recos');
  // ── Moneda de visualización (ARS / USD) ────────────────────────────────
  // Ahora sí está cableada. No hace falta nada nuevo: la app ya tiene el
  // circuito entero — `/api/dolar` (Vercel Function que pega a dolarapi blue y
  // cachea en Supabase), `fetchExchangeRate` y el contexto DisplayCurrency, que
  // envuelve toda la app desde App.tsx. Lo único que faltaba era pedir la
  // cotización desde acá: el efecto que la trae vive en Main.tsx, que es el
  // shell autenticado, y el sandbox v2 cuelga de rutas públicas que no pasan
  // por ahí.
  //
  // En `vite` local la función no corre (vite sirve api/dolar.ts como módulo),
  // así que fetchExchangeRate devuelve null y el toggle queda deshabilitado
  // solo-ARS. En el preview de Vercel funciona.
  const { rate, setRate, currency, setCurrency } = useDisplayCurrency();
  const { fmt, isUsd } = useMoney();
  useEffect(() => {
    if (rate) return; // ya la trajo otra pantalla: no la pisamos
    let vivo = true;
    fetchExchangeRate().then((r) => { if (vivo && r?.rate) setRate(r.rate); });
    return () => { vivo = false; };
  }, [rate, setRate]);

  // Se conserva el valor viejo de `monedaInv` para no pisar datos guardados.
  const monedaInv = persistido?.monedaInv;

  // Instrumento abierto en el detalle. Reemplaza al viejo set `expandido`, que
  // desplegaba el "por qué" dentro de la propia fila y hacía crecer la lista.
  const [detalle, setDetalle] = useState<Instrumento | null>(null);

  // Alta y edición de aporte comparten el mismo modal: es el mismo formulario,
  // y tener dos pantallas distintas para cargar y para corregir lo mismo obliga
  // a mantener dos veces la misma validación. `editandoId` distingue: null =
  // alta (arranca explicando qué es registrar, que es la duda más común la
  // primera vez), con id = edición (va directo a los datos, ya sabés qué es).
  const [aporteAbierto, setAporteAbierto] = useState(false);
  const [aportePaso, setAportePaso] = useState<'que-es' | 'datos'>('que-es');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  function cerrarAporte() {
    setAporteAbierto(false);
    setAportePaso('que-es');
    setEditandoId(null);
    setConfirmarBorrar(false);
    setAporteMonto('');
  }
  function abrirAlta() {
    setEditandoId(null);
    setConfirmarBorrar(false);
    setAporteMonto('');
    setAporteInstrId(INSTRUMENTOS[0].id);
    setAporteMoneda('ARS');
    setAportePaso('que-es');
    setAporteAbierto(true);
  }
  function abrirEdicion(a: Aporte) {
    setEditandoId(a.id);
    setConfirmarBorrar(false);
    setAporteInstrId(a.instrumentoId);
    setAporteMoneda(monedaDe(a));
    setAporteMonto(formatThousands(String(a.monto)));
    setAportePaso('datos');
    setAporteAbierto(true);
  }
  function guardarEdicion() {
    const monto = parseMoneyInput(aporteMonto);
    if (monto <= 0 || !editandoId) return;
    // Se conserva la fecha original: editar un monto mal tipeado no debería
    // mover el aporte a hoy y romper la evolución. La cotización SÍ se
    // reescribe con la de hoy si se pasa a dólares, porque es una carga nueva
    // en esa moneda; si sigue en pesos, no hay cotización que guardar.
    setAportes((prev) => prev.map((a) => (
      a.id === editandoId
        ? { ...a, ...nuevoAporte(monto), cotizacion: aporteMoneda === 'USD' && rate ? rate : undefined, instrumentoId: aporteInstrId }
        : a
    )));
  }
  function borrarAporte() {
    if (!editandoId) return;
    setAportes((prev) => prev.filter((a) => a.id !== editandoId));
  }
  useEffect(() => {
    if (!aporteAbierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarAporte(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [aporteAbierto]);

  useEffect(() => {
    if (!detalle) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetalle(null); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [detalle]);

  const [aportes, setAportes] = useState<Aporte[]>(() => persistido?.aportes ?? []);
  const [aporteMonto, setAporteMonto] = useState('');
  const [aporteInstrId, setAporteInstrId] = useState<string>(INSTRUMENTOS[0].id);
  // Moneda en la que se está cargando ESTE aporte. Es independiente de la
  // moneda de visualización de la pantalla: podés estar mirando totales en
  // dólares y cargar un aporte que hiciste en pesos.
  const [aporteMoneda, setAporteMoneda] = useState<Moneda>('ARS');

  useEffect(() => {
    saveV2InversionesState({ completado: paso === 'resultado', porQue, reaccion, yaInvierte, enQue, bancos, aportes, monedaInv });
  }, [paso, porQue, reaccion, yaInvierte, enQue, bancos, aportes, monedaInv]);

  const pasos: Paso[] = [
    ...(prefilledPerfil ? [] : (['q1', 'q2'] as Paso[])),
    ...(prefilledYaInvierte ? [] : (['yaInvierte'] as Paso[])),
    ...(yaInvierte === 'si' ? (['enQue'] as Paso[]) : []),
    'bancos',
  ];
  const stepIndex = pasos.indexOf(paso);

  function next() {
    const i = pasos.indexOf(paso);
    if (i === -1 || i === pasos.length - 1) { setPaso('resultado'); return; }
    setPaso(pasos[i + 1]);
  }
  const toggleEnQue = (o: string) => setEnQue((v) => (v.includes(o) ? v.filter((x) => x !== o) : [...v, o]));
  const toggleBanco = (b: string) => setBancos((v) => (v.includes(b) ? v.filter((x) => x !== b) : [...v, b]));

  // ── perfil calculado en base a lo que contestó, no fijo ──
  function calcularPerfil(): PerfilId {
    let score = reaccion === 'Pongo más' ? 2 : reaccion === 'Lo dejo y espero' ? 1 : 0;
    if (porQue === 'Sacarla pronto (corto plazo)') score -= 0.5;
    if (yaInvierte === 'si') score += 0.5;
    if (score <= 0.5) return 'conservador';
    if (score <= 1.5) return 'moderado';
    return 'arriesgado';
  }
  const perfilId = calcularPerfil();
  const perfil = PERFILES[perfilId];

  const yaEnIds = new Set(enQue.map((o) => EN_QUE_TO_INSTRUMENTO[o]).filter(Boolean));
  const recomendados = INSTRUMENTOS.filter((i) => i.perfiles.includes(perfilId))
    .sort((a, b) => Number(yaEnIds.has(a.id)) - Number(yaEnIds.has(b.id)))
    .slice(0, 3);

  // El equivalente en pesos se congela con la cotización del momento: si el
  // aporte fue en dólares, se guarda a cuánto estaba el blue ese día.
  function nuevoAporte(monto: number): Pick<Aporte, 'monto' | 'moneda' | 'cotizacion' | 'montoArs'> {
    if (aporteMoneda === 'USD' && rate) {
      return { monto, moneda: 'USD', cotizacion: rate, montoArs: Math.round(monto * rate) };
    }
    return { monto, moneda: 'ARS', montoArs: monto };
  }

  function agregarAporte() {
    const monto = parseMoneyInput(aporteMonto);
    if (monto <= 0) return;
    setAportes((a) => [{ id: String(Date.now()), ...nuevoAporte(monto), instrumentoId: aporteInstrId, ts: Date.now() }, ...a]);
    setAporteMonto('');
  }

  // Toggle segmentado claro reutilizable (moneda / tabs / modo evolución).

  // ── intro ──
  if (paso === 'intro') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
        {/* Banda editorial full-bleed. Sin Fini: la guía §6 dice que el
            personaje NO aparece en inversiones (plata seria). */}
        <header className="pb-1">
          <Titulo>Inversiones</Titulo>
          <p className="text-[15px] mt-1.5" style={{ color: COLORS.inkSoft }}>Armá tu perfil y te decimos qué te conviene. Nunca movemos tu plata.</p>
        </header>
        <button
          type="button"
          onClick={() => setPaso(pasos[0])}
          style={cardStyle}
          className={`v2-focus text-left ${CARD} p-5 flex flex-col gap-2 transition-transform duration-100 active:scale-[0.99]`}
        >
          <span className="text-[20px] font-bold" style={{ color: COLORS.ink }}>Averiguá tu perfil de inversor</span>
          <span className="text-[15px]" style={{ color: COLORS.inkSoft }}>
            {prefilledPerfil
              ? 'Ya nos contaste algo de esto en el onboarding — te faltan un par de preguntas más.'
              : '2 minutos, para que las recomendaciones tengan que ver con vos — sin comprometerte a nada.'}
          </span>
          <span className="self-end" style={{ color: COLORS.brand }}><IconChevron size={20} /></span>
        </button>
      </div>
    );
  }

  // ── resultado: perfil + 3 pestañas, en diseño claro de FINA ──
  if (paso === 'resultado') {
    // Se suma el equivalente en pesos congelado al momento de cada carga, no
    // el número tipeado: si no, un aporte en dólares se sumaría como si fueran
    // pesos. El total responde "cuánta plata pusiste", con la cotización de
    // cada día — no "cuánto valdría hoy si lo hubieras puesto todo hoy".
    const totalAportado = aportes.reduce((s, a) => s + montoArsDe(a), 0);
    // Si un aporte quedó apuntando a un instrumento que ya no está en el
    // catálogo, se decía el id crudo ("plazo") en la lista. Un slug interno no
    // es un nombre: mejor decir que no lo reconocemos que mostrar basura.
    const nombreInstr = (id: string) => INSTRUMENTOS.find((i) => i.id === id)?.nombre ?? 'Otro instrumento';
    const pl = PERFIL_LIGHT[perfilId];

    // Detalle de un instrumento. Es el "después entrá y ves todo": qué es,
    // qué le puede pasar a tu plata, por qué te lo recomendamos a VOS y desde
    // dónde lo podés hacer. Mismo patrón de modal que usa Objetivos, para no
    // inventar una tercera forma de mostrar algo encima de la pantalla.
    const modalDetalle = detalle && (
      <div
        className="fixed inset-0 z-30 flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: `${COLORS.ink}73` }}
        onClick={() => setDetalle(null)}
        role="dialog"
        aria-modal="true"
        aria-label={detalle.nombre}
      >
        <div
          className="w-full sm:max-w-[420px] max-h-[88vh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] p-6 flex flex-col gap-5"
          style={{ background: COLORS.surface }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <Titulo className="!text-[26px]">{detalle.nombre}</Titulo>
            <button
              type="button"
              onClick={() => setDetalle(null)}
              aria-label="Cerrar"
              className="v2-focus w-11 h-11 -mr-2 -mt-1 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
              style={{ color: COLORS.inkSoft }}
            >
              <IconClose size={18} />
            </button>
          </div>

          <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{detalle.desc}</p>

          <div className="flex flex-col gap-1.5">
            <TituloSeccion>Qué le puede pasar a tu plata</TituloSeccion>
            <p className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ color: COLORS.ink }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RIESGO_FILL[detalle.riesgo] }} aria-hidden />
              Riesgo {detalle.riesgo.toLowerCase()}
            </p>
            <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{RIESGO_EXPLICADO[detalle.riesgo]}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <TituloSeccion>Por qué te lo recomendamos</TituloSeccion>
            <p className="text-[15px] leading-relaxed" style={{ color: COLORS.inkSoft }}>{detalle.porQue}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <TituloSeccion>Dónde lo podés hacer</TituloSeccion>
            {(() => {
              const tuyas = detalle.apps.filter((a) => bancos.includes(a));
              const otras = detalle.apps.filter((a) => !bancos.includes(a));
              return (
                <>
                  {tuyas.length > 0 && (
                    <p className="text-[15px] leading-snug font-semibold" style={{ color: COLORS.limaText }}>
                      Ya lo tenés a mano desde {tuyas.join(' o ')}.
                    </p>
                  )}
                  {otras.length > 0 && (
                    <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
                      {tuyas.length > 0 ? 'También está en ' : 'Está disponible en '}{otras.join(', ')}.
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          <p className="text-[13px] leading-snug pt-1" style={{ color: COLORS.inkFaint }}>
            Esto es orientativo y no reemplaza asesoramiento financiero. FINA no mueve tu plata.
          </p>
        </div>
      </div>
    );

    // Alta de aporte. Paso 1: qué es esto. Paso 2: los datos. Se separan
    // porque "registrar un aporte" no se entiende solo: la primera reacción
    // es pensar que la app va a mover plata.
    const modalAporte = aporteAbierto && (
      <div
        className="fixed inset-0 z-30 flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: `${COLORS.ink}73` }}
        onClick={cerrarAporte}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar un aporte"
      >
        <div
          className="w-full sm:max-w-[420px] max-h-[88vh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] p-6 flex flex-col gap-5"
          style={{ background: COLORS.surface }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <Titulo className="!text-[26px]">{editandoId ? 'Editar registro' : 'Registrar un aporte'}</Titulo>
            <button
              type="button"
              onClick={cerrarAporte}
              aria-label="Cerrar"
              className="v2-focus w-11 h-11 -mr-2 -mt-1 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
              style={{ color: COLORS.inkSoft }}
            >
              <IconClose size={18} />
            </button>
          </div>

          {aportePaso === 'que-es' ? (
            <>
              <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>
                Anotá acá la plata que vos ya pusiste en algún instrumento, por fuera de FINA.
              </p>
              <div className="flex flex-col gap-1.5">
                <TituloSeccion>Esto no mueve tu plata</TituloSeccion>
                <p className="text-[15px] leading-relaxed" style={{ color: COLORS.inkSoft }}>
                  FINA no invierte ni toca tu dinero. Registrar es solo anotar, como en un cuaderno,
                  para que puedas ver todo junto y seguir cómo evoluciona.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <TituloSeccion>Para qué sirve</TituloSeccion>
                <p className="text-[15px] leading-relaxed" style={{ color: COLORS.inkSoft }}>
                  Con lo que anotes armamos tu evolución y te avisamos si hace rato que no le sumás.
                </p>
              </div>
              <Cta label="Registrar uno" onClick={() => setAportePaso('datos')} />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                <TituloSeccion>¿En qué lo pusiste?</TituloSeccion>
                {/* El mismo componente que el onboarding: con cinco
                    instrumentos, la última ocupa el ancho completo en vez de
                    dejar media celda huérfana. */}
                <OpcionesGrid
                  opciones={INSTRUMENTOS.map((i) => ({ id: i.id, label: i.nombre }))}
                  valor={aporteInstrId}
                  onElegir={setAporteInstrId}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <TituloSeccion>¿Cuánto?</TituloSeccion>
                {/* En qué moneda lo pusiste. Es independiente de la moneda en
                    que estás mirando los totales: podés ver en dólares y
                    cargar algo que hiciste en pesos. Si no hay cotización, el
                    dólar queda deshabilitado — sin ella no se puede guardar a
                    cuánto estaba, y ese dato es justamente el que evita que el
                    aporte se desfase después. */}
                <div className="flex gap-2">
                  {(['ARS', 'USD'] as Moneda[]).map((m) => {
                    const sinCotizacion = m === 'USD' && !rate;
                    const sel = aporteMoneda === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        aria-disabled={sinCotizacion || undefined}
                        title={sinCotizacion ? 'Todavía no tenemos la cotización del dólar' : undefined}
                        onClick={() => !sinCotizacion && setAporteMoneda(m)}
                        className="v2-focus flex-1 min-h-[48px] rounded-2xl text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                        style={sel
                          ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                          : { background: COLORS.surface, color: sinCotizacion ? COLORS.inkFaint : COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}`, cursor: sinCotizacion ? 'not-allowed' : 'pointer' }}
                      >
                        {m === 'ARS' ? 'En pesos' : 'En dólares'}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{aporteMoneda === 'USD' ? 'US$' : '$'}</span>
                  <input
                    autoFocus
                    aria-label={`Monto del aporte en ${aporteMoneda === 'USD' ? 'dólares' : 'pesos'}`}
                    className={`v2-focus w-full rounded-2xl ${aporteMoneda === 'USD' ? 'pl-14' : 'pl-8'} pr-4 py-3 text-[18px] font-mono tabular-nums outline-none transition-colors`}
                    style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
                    placeholder="Monto"
                    inputMode="decimal"
                    value={aporteMonto}
                    onChange={(e) => setAporteMonto(formatThousands(e.target.value))}
                  />
                </div>
                {/* Se dice el equivalente y con qué cotización queda guardado,
                    para que no haya sorpresa después. */}
                {aporteMoneda === 'USD' && rate && parseMoneyInput(aporteMonto) > 0 && (
                  <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
                    Son <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtMoney(parseMoneyInput(aporteMonto) * rate)}</span> al blue de hoy
                    (<span className="font-mono tabular-nums">{fmtMoney(rate)}</span>). Queda guardado a esa cotización.
                  </p>
                )}
              </div>

              <Cta
                label={editandoId ? 'Guardar cambios' : 'Guardar'}
                disabled={parseMoneyInput(aporteMonto) <= 0}
                onClick={() => { if (editandoId) guardarEdicion(); else agregarAporte(); cerrarAporte(); }}
              />

              {/* Borrar. La confirmación se pide en el mismo lugar en vez de un
                  window.confirm: el diálogo del navegador saca a la persona de
                  la app y no dice qué se está por borrar. */}
              {editandoId && (
                confirmarBorrar ? (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
                      ¿Borramos este registro de {nombreInstr(aporteInstrId)}? Se saca de tu total y de tu evolución.
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfirmarBorrar(false)}
                        className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                        style={{ color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => { borrarAporte(); cerrarAporte(); }}
                        className="v2-focus flex-1 rounded-2xl py-3.5 text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                        style={{ background: COLORS.naranja, color: COLORS.ink }}
                      >
                        Sí, borrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmarBorrar(true)}
                    className="v2-focus min-h-[44px] text-[15px] font-semibold rounded-2xl transition-all duration-100 active:scale-[0.98]"
                    style={{ color: COLORS.naranjaText }}
                  >
                    Borrar este registro
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    );

    return (
      <div className="pb-6">
        {modalDetalle}
        {modalAporte}
        <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
          {/* Banda editorial full-bleed. Sin Fini (guía §6): el personaje nunca
              va cerca de un dato, y menos en inversiones. */}
          <header className="pb-1">
            <Titulo>Inversiones</Titulo>
            <p className="text-[15px] mt-1" style={{ color: COLORS.inkSoft }}>Según tu perfil, esto es lo que te conviene.</p>
          </header>
          {/* El perfil en una línea + el toggle de moneda, que ahora sí hace
              algo. Cuando no hay cotización (local, o si la función falla) el
              USD queda deshabilitado y se dice por qué, en vez de ofrecer un
              botón que no responde. */}
          <div className="flex items-start justify-between gap-3">
            <p className="flex-1 text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Sos <span className="font-bold" style={{ color: pl.strong }}>perfil {perfil.label.toLowerCase()}</span>: {perfil.copy.charAt(0).toLowerCase() + perfil.copy.slice(1)}
            </p>
            <div className="flex rounded-full p-0.5 shrink-0" style={{ background: COLORS.tint }}>
              {(['ARS', 'USD'] as const).map((c) => {
                const sinCotizacion = c === 'USD' && !rate;
                const activo = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => !sinCotizacion && setCurrency(c)}
                    aria-pressed={activo}
                    aria-disabled={sinCotizacion || undefined}
                    title={sinCotizacion ? 'Todavía no tenemos la cotización del dólar' : `Ver en ${c === 'ARS' ? 'pesos' : 'dólares'}`}
                    className="v2-focus rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors duration-150"
                    style={activo
                      ? { background: COLORS.brand, color: COLORS.surface }
                      : { color: sinCotizacion ? COLORS.inkFaint : COLORS.inkSoft, cursor: sinCotizacion ? 'not-allowed' : 'pointer' }}
                  >
                    {c === 'ARS' ? 'Pesos' : 'USD'}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Un monto convertido es un dato DERIVADO, no declarado: se dice a
              qué se convirtió y con qué (§5). Sin esto, "US$ 120" parece que
              pusiste dólares, cuando pusiste pesos. */}
          {isUsd && (
            <p className="text-[13px] leading-snug pl-3.5 border-l-2 -mt-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
              El total está pasado a dólares con el blue de hoy. Cada registro se muestra en la moneda en que lo cargaste.
            </p>
          )}

          <Tabs
            options={[
              { id: 'recos' as Tab, label: 'Recomendaciones' },
              { id: 'mias' as Tab, label: 'Mis inversiones' },
              { id: 'evolucion' as Tab, label: 'Simular' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'recos' && (
            <div className="flex flex-col gap-1">
              {enQue.length > 0 && (
                <p className="text-[14px] leading-snug font-semibold pl-3.5 border-l-2" style={{ color: COLORS.limaText, borderColor: COLORS.lima }}>
                  Ya invertís en {enQue.join(', ')} — priorizamos otras opciones para diversificar.
                </p>
              )}
              {/* DIVULGACIÓN PROGRESIVA. Antes cada fila mostraba a la vez el
                  nombre, una pastilla de riesgo, dónde tenerlo, "ya lo hacés"
                  y un desplegable con el porqué: cinco datos por ítem, quince
                  en pantalla, para alguien que capaz nunca invirtió. Ahora la
                  fila dice UNA cosa —qué es, en criollo— y todo lo demás vive
                  en el detalle, a un toque.

                  Un cambio de fondo: la fila mostraba "lo tenés a mano desde tu
                  X" EN LUGAR de la descripción. Para quien no sabe qué es un
                  FCI, saber desde qué app se hace no le sirve de nada si antes
                  no sabe qué es. La descripción manda; el banco pasa al
                  detalle, que es donde importa cuando ya decidiste. */}
              {recomendados.map((r) => {
                const already = yaEnIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDetalle(r)}
                    className="v2-focus w-full text-left flex items-center gap-3 py-4 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
                    style={{ borderColor: COLORS.line }}
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[17px]" style={{ color: COLORS.ink }}>{r.nombre}</span>
                        {already && (
                          <span className="text-[12px] font-semibold rounded-full px-2 py-0.5" style={{ background: COLORS.limaSoft, color: COLORS.limaText }}>
                            Ya lo hacés
                          </span>
                        )}
                      </span>
                      <span className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.desc}</span>
                    </span>
                    <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={18} /></span>
                  </button>
                );
              })}
              <p className="text-[12px] px-1" style={{ color: COLORS.inkFaint }}>Esto es orientativo y no reemplaza asesoramiento financiero. FINA no mueve tu plata.</p>
            </div>
          )}

          {tab === 'mias' && (
            <div className="flex flex-col gap-3">
              <div className="py-2 flex gap-4 items-center">
                <Donut
                  segments={INSTRUMENTOS.map((i) => ({
                    color: RIESGO_FILL[i.riesgo],
                    pct: totalAportado > 0 ? (aportes.filter((a) => a.instrumentoId === i.id).reduce((s, a) => s + montoArsDe(a), 0) / totalAportado) * 100 : 0,
                  }))}
                  centerLabel="Invertido"
                  centerValue={fmt(totalAportado)}
                  size={100}
                />
                <div className="flex-1 flex flex-col gap-1.5">
                  <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Vas registrando lo que ponés en cada instrumento acá abajo.</p>
                  {/* Lo invertido es lo que la persona cargó: dato declarado (§5). */}
                  <EstadoConfianza estado="declarado" />
                </div>
              </div>

              {/* Registrar un aporte pasa de formulario siempre abierto a
                  botón. El formulario ocupaba media pantalla y empujaba los
                  registros —que es lo que uno viene a mirar— abajo del fondo.
                  Ahora el botón abre un paso que primero explica qué es esto
                  (registrar no mueve plata: FINA no toca tu dinero) y recién
                  después pide instrumento y monto. */}
              <button
                type="button"
                onClick={abrirAlta}
                className="v2-focus w-full rounded-2xl py-4 text-[17px] font-bold select-none transition-all duration-100 ease-out active:scale-[0.98]"
                style={{ background: COLORS.brand, color: COLORS.surface, boxShadow: '0 10px 24px -8px rgba(118,38,179,0.45)' }}
              >
                + Registrar un aporte
              </button>

              {/* Los registros se ven sin apretar nada. */}
              <div className="flex flex-col gap-2 pt-2">
                <TituloSeccion>Tus registros</TituloSeccion>
                {aportes.length === 0 ? (
                  <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste aportes. Cuando sumes el primero, lo vas a ver acá.</p>
                ) : (
                  <div className="flex flex-col">
                    {/* Cada registro se toca para editarlo o borrarlo. Se
                        prefiere abrir el mismo formulario antes que meter dos
                        iconos por fila: con cinco registros serían diez
                        controles chiquitos compitiendo con el dato. */}
                    {aportes.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => abrirEdicion(a)}
                        aria-label={`Editar el aporte de ${nombreInstr(a.instrumentoId)}`}
                        className="v2-focus w-full text-left flex items-center justify-between gap-3 min-h-[56px] py-3 border-b last:border-b-0 transition-all duration-100 active:scale-[0.99]"
                        style={{ borderColor: COLORS.line }}
                      >
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="text-[15px] truncate" style={{ color: COLORS.ink }}>{nombreInstr(a.instrumentoId)}</span>
                          <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>{fechaDisplay(a.ts)}</span>
                        </span>
                        {/* Se muestra lo que cargaste, en la moneda en que lo
                            cargaste: eso es el hecho y no se convierte nunca.
                            Lo que sí respeta el toggle de arriba es el TOTAL,
                            que es un derivado. */}
                        <span className="text-[15px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>
                          {monedaDe(a) === 'USD' ? `US$ ${a.monto.toLocaleString('es-AR')}` : fmtMoney(a.monto)}
                        </span>
                        <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Antes acá había dos vistas: "Mis aportes" y "Simular". La primera
              se sacó. No era un problema de dibujo: el eje X era el ÍNDICE del
              aporte, no el tiempo, así que dos aportes con un año de diferencia
              se veían igual que dos del mismo día; y la proyección componía una
              vez por aporte, o sea que cargar cinco aportes hoy mostraba un año
              de crecimiento. Y por debajo de eso hay algo que no se arregla
              moviendo código: FINA no sabe cómo rindieron de verdad las
              inversiones de nadie —solo sabe lo que la persona declaró que
              puso—, así que dibujar una curva de crecimiento sobre aportes
              reales promete un rendimiento que no podemos conocer.
              El simulador sí es honesto: es explícitamente hipotético, compone
              por MES y muestra el resultado como rango. */}
          {tab === 'evolucion' && <Simulador tasaMensual={perfil.tasaMensual} />}
        </div>
      </div>
    );
  }

  // ── q1 / q2 / yaInvierte / enQue / bancos comparten el layout del stepper ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
      <div className="flex justify-center gap-2">
        {pasos.map((p, i) => (
          <span key={p} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= stepIndex ? COLORS.brand : COLORS.lineStrong }} />
        ))}
      </div>

      {paso === 'q1' && (
        <>
          <Titulo>¿Con qué objetivo querés invertir esa plata?</Titulo>
          <div className="flex flex-wrap gap-2.5">
            {['Sacarla pronto (corto plazo)', 'Dejarla que rinda (largo plazo)'].map((o) => (
              <Chip key={o} on={porQue === o} onClick={() => setPorQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'q2' && (
        <>
          <Titulo>
            Estás en una inversión que sube y baja en el camino, pero promete crecer a 5 años a una tasa razonable. ¿Qué hacés?
          </Titulo>
          <div className="flex flex-wrap gap-2.5">
            {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
              <Chip key={o} on={reaccion === o} onClick={() => setReaccion(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'yaInvierte' && (
        <>
          <Titulo>¿Ya invertís hoy en algo?</Titulo>
          <div className="flex flex-wrap gap-2.5">
            {(['si', 'no'] as const).map((o) => (
              <Chip key={o} on={yaInvierte === o} onClick={() => setYaInvierte(o)}>{o === 'si' ? 'Sí' : 'No'}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'enQue' && (
        <>
          <Titulo>¿En qué invertís?</Titulo>
          <div className="flex flex-wrap gap-2.5">
            {EN_QUE_OPCIONES.map((o) => (
              <Chip key={o} on={enQue.includes(o)} onClick={() => toggleEnQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'bancos' && (
        <>
          <Titulo>¿Qué bancos o billeteras usás?</Titulo>
          <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Así te decimos exactamente desde dónde hacerlo.</p>
          <div className="flex flex-wrap gap-2.5">
            {BANCOS.map((b) => (
              <Chip key={b} on={bancos.includes(b)} onClick={() => toggleBanco(b)}>{b}</Chip>
            ))}
          </div>
        </>
      )}

      <Cta label={paso === 'bancos' ? 'Ver mi resultado' : 'Continuar'} onClick={next} />
    </div>
  );
}

// Serie de puntos para una polilínea SVG. La usa el simulador.
function serieAPath(arr: number[], w: number, h: number, pad: number, max: number) {
  return arr
    .map((v, i) => {
      const x = pad + (arr.length > 1 ? (i / (arr.length - 1)) * (w - 2 * pad) : (w - 2 * pad) / 2);
      const y = h - pad - (v / max) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');
}

// Simulador con plata ficticia — pensado para bajar el miedo de quien
// nunca invirtió: "probalo antes de comprometerte". Usa la misma tasa
// mensual ilustrativa del perfil ya calculado, pero con un monto y un
// plazo que la persona inventa, no con aportes reales. Es la única
// proyección que queda en la pantalla, y es honesta por construcción: la
// persona sabe que los números son de mentira, compone por MES (no por
// aporte, que era el error de la vista que se sacó) y el resultado se
// muestra como rango, nunca como número exacto (§5.2).
function Simulador({ tasaMensual }: { tasaMensual: number }) {
  const [monto, setMonto] = useState('10.000');
  const [meses, setMeses] = useState(12);
  const montoNum = parseMoneyInput(monto);

  const serieAportado: number[] = [];
  const serieProyectado: number[] = [];
  let acumAp = 0;
  let acumProy = 0;
  // Banda de estimación: la proyección nunca es un número exacto (§5.2), así
  // que además del punto medio calculamos un piso y un techo (media tasa /
  // tasa y media) para mostrar el resultado como RANGO, no como certeza.
  let acumLo = 0;
  let acumHi = 0;
  for (let i = 0; i < meses; i++) {
    acumAp += montoNum;
    acumProy = (acumProy + montoNum) * (1 + tasaMensual);
    acumLo = (acumLo + montoNum) * (1 + tasaMensual * 0.5);
    acumHi = (acumHi + montoNum) * (1 + tasaMensual * 1.5);
    serieAportado.push(acumAp);
    serieProyectado.push(acumProy);
  }
  const max = Math.max(...serieAportado, ...serieProyectado, 1);
  const w = 280, h = 130, pad = 10;
  const totalAportado = serieAportado[serieAportado.length - 1] ?? 0;
  const proyeccionLo = acumLo;
  const proyeccionHi = acumHi;
  // Aportado = declarado (línea llena, neutral); proyección = estimado
  // (línea punteada). El trazo dice la confianza, no el color (§5.1).
  const realColor = COLORS.ink;
  const proyColor = COLORS.brand;

  return (
    <div className={BLOQUE}>
      <TituloSeccion>Probá antes de invertir plata real</TituloSeccion>
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-3" style={{ color: COLORS.inkSoft }}>$</span>
        <input
          className="v2-focus w-full rounded-xl pl-7 pr-3 py-2.5 text-[15px] font-['IBM_Plex_Mono'] tabular-nums outline-none border transition-colors"
          style={{ background: COLORS.surface, color: COLORS.ink, borderColor: COLORS.lineStrong }}
          placeholder="Cuánto pondrías por mes"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(formatThousands(e.target.value))}
        />
      </div>
      <div className="flex gap-2">
        {[6, 12, 24].map((m) => {
          const sel = meses === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMeses(m)}
              aria-pressed={sel}
              className="v2-focus flex-1 rounded-xl py-2.5 text-[14px] font-semibold transition-all duration-100 active:scale-95"
              style={sel ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.tint, color: COLORS.inkSoft }}
            >
              {m} meses
            </button>
          );
        })}
      </div>

      {montoNum > 0 && (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]">
            <polyline points={serieAPath(serieProyectado, w, h, pad, max)} fill="none" stroke={proyColor} strokeWidth="3" strokeDasharray="2 4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={serieAPath(serieAportado, w, h, pad, max)} fill="none" stroke={realColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: realColor }} /> Pondrías</span>
            <span className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}><span className="w-4 h-0.5 rounded-full" style={{ background: proyColor }} /> Tendrías (estimado)</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {/* Lo que pondrías es aritmética de lo que dijiste: declarado, exacto. */}
            <div className="py-2.5 border-b" style={{ borderColor: COLORS.line }}>
              <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>En {meses} meses pondrías</p>
              <Monto value={totalAportado} className="font-bold text-[18px]" />
            </div>
            {/* Lo que tendrías es una PROYECCIÓN: se muestra como rango, nunca
                como número exacto (§5.2). Se angosta cuando hay más certeza. */}
            <div className="py-2.5 flex flex-col gap-1.5">
              <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Podrías tener</p>
              <Rango min={proyeccionLo} max={proyeccionHi} />
              <EstadoConfianza estado="estimado" />
            </div>
          </div>
        </>
      )}
      <p className="text-[12px]" style={{ color: COLORS.inkFaint }}>Es una simulación con números inventados — no es una promesa de rendimiento ni mueve plata real.</p>
      <ArmarGrupoBtn />
    </div>
  );
}

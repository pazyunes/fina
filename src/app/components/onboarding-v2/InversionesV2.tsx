import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAlLlegar } from './alLlegar';
import { BotonVolver, COLORS, Chip, Cta, OpcionesGrid, Tabs, Titulo, TituloSeccion, fechaDisplay, fmtMoney, formatMontoInicial, formatThousands, parseMoneyInput } from './shared';
import { ALIAS_PROVEEDOR, EN_QUE_A_PRODUCTO, type ProveedorId } from '../../lib/inversiones/catalogo';
import { calcularSobrante, hayGastoCercanoSinCubrir, horizonteDesdeQuiz, sugerirMonto } from '../../lib/inversiones/cuanto';
import type { Valores } from '../../lib/inversiones/registro';
import type { PosicionInversion } from '../../api/v2/tipos';
import { calcularInflacionPersonal } from '../../lib/inversiones/inflacionPersonal';
import { paraInvertir } from '../../lib/inversiones/objetivos';
import { enMoneda, sumarEn } from '../../api/v2/conversion';
import { AvisoLegal } from './inversiones/AvisoLegal';
import { Desplegable } from './inversiones/Desplegable';
import { MisInversiones } from './inversiones/MisInversiones';
import { RecomendacionesTab } from './inversiones/RecomendacionesTab';
import { RegistroPosicion } from './inversiones/RegistroPosicion';
import { Simulador } from './inversiones/Simulador';
import { useMercado } from '../../lib/inversiones/useMercado';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import * as acciones from '../../api/v2/acciones';
import { IconChevron, IconClose } from './FinaIcons';
import { useDisplayCurrency } from '../../lib/displayCurrency';
import { fetchExchangeRate } from '../../lib/exchangeRate';

// REDISEÑO v2 — Inversiones. La clave es la personalización (pedido
// explícito): un mini-quiz corto arma un perfil de riesgo real (no fijo),
// pregunta si ya invertís (y en qué) y qué bancos/billeteras usás — y con
// eso arma recomendaciones que tienen en cuenta lo que ya hacés y desde
// dónde lo podés hacer. Mismo catálogo/lógica que InversionesPage.tsx de
// la app real, adaptado al flujo v2.
//
// Una vez armado el perfil, la pantalla se divide en 3 (pedido explícito):
// Recomendaciones / Mis inversiones / Mi evolución. Todo en el diseño CLARO
// de FINA (blanco + violeta), coherente con el resto de la app.

type Paso = 'intro' | 'q1' | 'q2' | 'yaInvierte' | 'enQue' | 'bancos' | 'resultado';
type PerfilId = 'conservador' | 'moderado' | 'arriesgado';
type Tab = 'mias' | 'recos' | 'evolucion';

const BANCOS = ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank', 'Cocos Capital', 'Balanz', 'IOL', 'Galicia Securities', 'PPI', 'IEB', 'Banco tradicional', 'Efectivo', 'Otro'];
const EN_QUE_OPCIONES = ['Plazo fijo', 'Fondo común (FCI)', 'Dólar', 'CEDEARs / acciones', 'Cripto', 'Otro'];
// Catálogo VIEJO: ya no recomienda nada (las recomendaciones salen de
// lib/inversiones). Queda únicamente para ponerle nombre a los registros que se
// cargaron antes como "cuánto y en qué" (tabla investment_contributions).
const INSTRUMENTOS: { id: string; nombre: string }[] = [
  { id: 'cuenta_remunerada', nombre: 'Cuenta remunerada' },
  { id: 'plazo_fijo', nombre: 'Plazo fijo UVA' },
  { id: 'fci', nombre: 'Fondo Común de Inversión' },
  { id: 'dolar_mep', nombre: 'Dólar MEP' },
  { id: 'cedears', nombre: 'CEDEARs' },
];

// Sin emoji de nivel de riesgo (guía §2/§5.4: nunca un emoji, menos en un dato).
// El nivel se dice con palabra y con el relleno de la paleta, no con dibujitos.
const PERFILES: Record<PerfilId, { label: string; copy: string }> = {
  conservador: { label: 'Conservador', copy: 'Preferís cuidar lo que tenés antes que arriesgar de más.' },
  moderado: { label: 'Moderado', copy: 'Buscás un equilibrio entre seguridad y crecimiento.' },
  arriesgado: { label: 'Arriesgado', copy: 'Te bancás más vaivén a cambio de más potencial de crecimiento.' },
};

// Tinte + texto por perfil, todo desde la paleta de la guía (§3.3): relleno
// suave de fondo + su token -Text (≥6:1) para la tipografía. Nada de hex crudo.
const PERFIL_LIGHT: Record<PerfilId, { soft: string; strong: string }> = {
  conservador: { soft: COLORS.limaSoft, strong: COLORS.limaText },
  moderado: { soft: COLORS.starSoft, strong: COLORS.starText },
  arriesgado: { soft: COLORS.naranjaSoft, strong: COLORS.naranjaText },
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
// (Se fue `PersistidoInv`: era la forma del blob que esta pantalla guardaba en
// localStorage. Ahora el perfil inversor y los aportes son filas de Supabase,
// con su forma en api/v2/tipos.ts.)

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
  // Todo sale del almacén: el perfil inversor es una fila de
  // `investment_profiles` y los aportes son filas de
  // `investment_contributions`. Antes esta pantalla guardaba un blob en
  // localStorage, así que los aportes no existían para el bot ni sobrevivían
  // a cambiar de teléfono.
  const { estado: db } = useAlmacen();
  const perfilGuardado = db.perfilInversor;

  const [prefilledPerfil] = useState(() => !!(perfilGuardado?.porQue && perfilGuardado?.reaccion));
  // `completadoEn` y no "existe el perfil": las dos preguntas del onboarding ya
  // crean la fila, y quien sólo pasó por ahí tiene que seguir el quiz.
  const [paso, setPaso] = useState<Paso>(() => (perfilGuardado?.completadoEn ? 'resultado' : 'intro'));
  const [porQue, setPorQue] = useState<string | null>(() => perfilGuardado?.porQue ?? null);
  const [reaccion, setReaccion] = useState<string | null>(() => perfilGuardado?.reaccion ?? null);
  // "¿Invertís?" ya se contestó en el onboarding (pregunta de hábitos, con
  // más matices que un sí/no) — si esa respuesta viajó hasta acá, no se
  // repregunta de nuevo.
  const [prefilledYaInvierte] = useState(() => perfilGuardado?.yaInvierte !== null && perfilGuardado?.yaInvierte !== undefined);
  const [yaInvierte, setYaInvierte] = useState<'si' | 'no' | null>(
    () => (perfilGuardado?.yaInvierte === null || perfilGuardado?.yaInvierte === undefined ? null : perfilGuardado.yaInvierte ? 'si' : 'no'),
  );
  const [enQue, setEnQue] = useState<string[]>(() => perfilGuardado?.enQue ?? []);
  const [bancos, setBancos] = useState<string[]>(() => perfilGuardado?.bancos ?? []);
  const [tab, setTab] = useState<Tab>('recos');
  // ── Moneda de visualización (ARS / USD) ────────────────────────────────
  // Ahora sí está cableada. No hace falta nada nuevo: la app ya tiene el
  // circuito entero — `/api/dolar` (Vercel Function que pega a dolarapi blue y
  // cachea en Supabase), `fetchExchangeRate` y el contexto DisplayCurrency, que
  // envuelve toda la app desde App.tsx. Lo único que faltaba era pedir la
  // cotización desde acá: el efecto que la trae vive en Main.tsx, que es el
  // shell autenticado, y las rutas del v2 no pasan por ahí.
  //
  // En `vite` local la función no corre (vite sirve api/dolar.ts como módulo),
  // así que fetchExchangeRate devuelve null y el toggle queda deshabilitado
  // solo-ARS. En el preview de Vercel funciona.
  //
  // Lo mismo aplica al aporte en dólares: sin cotización no se puede congelar
  // el equivalente en pesos, y la carga avisa en vez de inventar un número.
  const { rate, setRate } = useDisplayCurrency();
  useEffect(() => {
    if (rate) return; // ya la trajo otra pantalla: no la pisamos
    let vivo = true;
    fetchExchangeRate().then((r) => { if (vivo && r?.rate) setRate(r.rate); });
    return () => { vivo = false; };
  }, [rate, setRate]);

  // Registrar una inversión (formulario específico por tipo). `previos` viene del
  // paso a paso: ya sabe el proveedor y el monto con el que empezó.
  const [registro, setRegistro] = useState<{ tipo?: PosicionInversion['tipo']; previos?: Partial<Valores>; desdeGuia?: boolean } | null>(null);
  const abrirRegistro = (tipo?: PosicionInversion['tipo'], previos?: Partial<Valores>, desdeGuia?: boolean) => setRegistro({ tipo, previos, desdeGuia });
  // Si se volvió del registro al paso a paso, de cuál inversión.
  const [volverAGuia, setVolverAGuia] = useState<PosicionInversion['tipo'] | null>(null);
  const alReabrirGuia = useCallback(() => setVolverAGuia(null), []);
  const { estado: estadoMercado } = useMercado();

  // Los registros VIEJOS (sólo "cuánto y en qué") se siguen pudiendo corregir y
  // borrar desde este modal. Registrar algo nuevo pasa por RegistroPosicion.
  const [aporteAbierto, setAporteAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  function cerrarAporte() {
    setAporteAbierto(false);
    setEditandoId(null);
    setConfirmarBorrar(false);
    setAporteMonto('');
  }
  // Desde "Tu paso de hoy" en Home se llega directo a hacer el paso:
  // "Registrar un aporte" abre el formulario ya en los datos (la persona tocó
  // un botón que dice registrar, no "ver inversiones"), y "Armar mi perfil"
  // saltea la tarjeta de intro y arranca por la primera pregunta.
  useAlLlegar('aporte', () => {
    if (paso !== 'resultado') return;
    setTab('mias');
    abrirRegistro();
  });
  useAlLlegar('quiz', () => {
    if (paso === 'intro') setPaso(pasos[0]);
  });
  function abrirEdicion(a: Aporte) {
    setEditandoId(a.id);
    setConfirmarBorrar(false);
    setAporteInstrId(a.instrumentoId);
    setAporteMoneda(monedaDe(a));
    setAporteMonto(formatMontoInicial(a.monto));
    setAporteAbierto(true);
  }
  function guardarEdicion() {
    const monto = parseMoneyInput(aporteMonto);
    if (monto <= 0 || !editandoId) return;
    // Se conserva la fecha original: editar un monto mal tipeado no debería
    // mover el aporte a hoy y romper la evolución. La cotización SÍ se
    // reescribe con la de hoy si se pasa a dólares, porque es una carga nueva
    // en esa moneda; si sigue en pesos, no hay cotización que guardar.
    const datos = nuevoAporte(monto);
    acciones.editarAporte(editandoId, {
      instrumento: aporteInstrId,
      monto: datos.monto,
      moneda: datos.moneda ?? 'ARS',
      montoArs: datos.montoArs,
    });
  }
  function borrarAporte() {
    if (!editandoId) return;
    acciones.borrarAporte(editandoId);
  }
  useEffect(() => {
    if (!aporteAbierto) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarAporte(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [aporteAbierto]);

  const aportes = useMemo<Aporte[]>(() => db.aportes.map((a) => ({
    id: a.id,
    monto: a.monto,
    moneda: a.moneda,
    cotizacion: a.cotizacion ?? undefined,
    montoArs: a.montoArs,
    instrumentoId: a.instrumento,
    ts: a.ts,
  })), [db.aportes]);
  const [aporteMonto, setAporteMonto] = useState('');
  const [aporteInstrId, setAporteInstrId] = useState<string>(INSTRUMENTOS[0].id);
  // Moneda en la que se está cargando ESTE aporte. Es independiente de la
  // moneda de visualización de la pantalla: podés estar mirando totales en
  // dólares y cargar un aporte que hiciste en pesos.
  const [aporteMoneda, setAporteMoneda] = useState<Moneda>('ARS');

  // El perfil se guarda cuando cambia alguna de sus respuestas. Los aportes NO
  // pasan por acá: cada uno se escribe en el momento en que se carga.
  useEffect(() => {
    // Nada que guardar todavía: no se contestó ni la primera pregunta.
    if (!porQue && !reaccion && yaInvierte === null && enQue.length === 0 && bancos.length === 0) return;
    acciones.guardarPerfilInversor({
      porQue,
      reaccion,
      yaInvierte: yaInvierte === null ? null : yaInvierte === 'si',
      enQue,
      bancos,
      // La fecha se pone una sola vez: es cuándo terminó el quiz, no la última
      // vez que tocó algo.
      completadoEn: paso === 'resultado'
        ? (perfilGuardado?.completadoEn ?? new Date().toISOString())
        : (perfilGuardado?.completadoEn ?? null),
    });
  }, [paso, porQue, reaccion, yaInvierte, enQue, bancos]);

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

  // El equivalente en pesos se congela con la cotización del momento: si el
  // aporte fue en dólares, se guarda a cuánto estaba el blue ese día.
  function nuevoAporte(monto: number): Pick<Aporte, 'monto' | 'moneda' | 'cotizacion' | 'montoArs'> {
    if (aporteMoneda === 'USD' && rate) {
      return { monto, moneda: 'USD', cotizacion: rate, montoArs: Math.round(monto * rate) };
    }
    return { monto, moneda: 'ARS', montoArs: monto };
  }

  // Toggle segmentado claro reutilizable (moneda / tabs / modo evolución).

  // ── intro ──
  if (paso === 'intro') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
        {/* Banda editorial full-bleed. Sin Fini: la guía §6 dice que el
            personaje NO aparece en inversiones (plata seria). */}
        <header data-franja className="pb-1 mb-2">
          <Titulo>Inversiones</Titulo>
          <p className="text-[15px] mt-1.5" style={{ color: COLORS.inkSoft }}>Armá tu perfil y te mostramos alternativas. Nunca movemos tu plata.</p>
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
              : '2 minutos, para que las alternativas tengan que ver con vos — sin comprometerte a nada.'}
          </span>
          <span className="self-end" style={{ color: COLORS.brand }}><IconChevron size={20} /></span>
        </button>
      </div>
    );
  }

  // ── resultado: perfil + 3 pestañas, en diseño claro de FINA ──
  if (paso === 'resultado') {
    // Si un registro viejo quedó apuntando a un instrumento que ya no está en el
    // catálogo, se decía el id crudo en la lista. Un slug interno no es un
    // nombre: mejor decir que no lo reconocemos que mostrar basura.
    const nombreInstr = (id: string) => INSTRUMENTOS.find((i) => i.id === id)?.nombre ?? 'Otro instrumento';
    const pl = PERFIL_LIGHT[perfilId];

    // Lo que las recomendaciones necesitan saber de ESTA persona: qué usa ya,
    // cuánto le sobra, cuánto colchón tiene y para cuándo es la plata.
    const usa = [...new Set(bancos.map((b) => ALIAS_PROVEEDOR[b]).filter((x): x is ProveedorId => !!x))];
    const sobrante = calcularSobrante(db.ingresos, db.gastos);
    // Un fondo de garantía sólo si hay un gasto cercano que no se cubre con lo que ingresa; si no, lo que sobra se invierte.
    const gastoCercano = hayGastoCercanoSinCubrir(
      db.gastosFijos.map((g) => ({ montoArs: enMoneda({ monto: g.monto, moneda: g.moneda, montoArs: null }, 'ARS', db.dolar) ?? 0, proximoPago: g.proximoPago })),
      sobrante?.ingresoMensual ?? null,
    );
    // El dólar entra entre las alternativas sólo si hay un objetivo en dólares todavía sin juntar.
    const objetivoEnDolares = db.objetivos.some((o) => o.moneda === 'USD' && (o.montoTotal === null || sumarEn(o.contribuciones, o.moneda, db.dolar).total < o.montoTotal));
    const sugerencia = sugerirMonto(sobrante);
    const horizonteMeses = horizonteDesdeQuiz(porQue);
    // Los objetivos de esta persona, listos para decirle cuánto separar por mes.
    const juntadoDe = (o: (typeof db.objetivos)[number]) => sumarEn(o.contribuciones, o.moneda, db.dolar).total;
    const objetivos = db.objetivos
      .map((o) => paraInvertir(o, juntadoDe(o), o.horizonte))
      .filter((o): o is NonNullable<typeof o> => o !== null);
    const objetivosPorId = Object.fromEntries(db.objetivos.map((o) => [o.id, { nombre: o.nombre, montoTotal: o.montoTotal, juntado: juntadoDe(o) }]));
    // La inflación de esta persona: lo que subió lo que ella consume, con sus propios gastos y su zona.
    const ipc = estadoMercado.tipo === 'listo' ? estadoMercado.mercado.ipc?.valor ?? null : null;
    const inflacionPersonal = calcularInflacionPersonal(
      db.gastos.map((g) => ({ montoArs: g.montoArs, ts: g.ts, seccion: db.secciones.find((x) => x.id === g.seccionId)?.nombre ?? null })),
      ipc,
      db.perfil.zona,
    );
    // Productos en los que la persona dijo que ya invierte (quiz) o que ya registró.
    const productosQuiz = enQue.flatMap((o) => EN_QUE_A_PRODUCTO[o] ?? []);

    // Edición de un registro viejo (sólo "cuánto y en qué").
    const modalAporte = aporteAbierto && (
      <div
        className="fixed inset-0 z-30 flex items-end sm:items-center justify-center sm:p-5"
        style={{ background: `${COLORS.ink}73` }}
        onClick={cerrarAporte}
        role="dialog"
        aria-modal="true"
        aria-label="Editar registro"
      >
        <div
          className="w-full sm:max-w-[420px] max-h-[88vh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] p-6 flex flex-col gap-5"
          style={{ background: COLORS.surface }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <Titulo className="!text-[26px]">Editar registro</Titulo>
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

          {(
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
                label="Guardar cambios"
                disabled={parseMoneyInput(aporteMonto) <= 0}
                onClick={() => { guardarEdicion(); cerrarAporte(); }}
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
        {modalAporte}
        {registro && (
          <RegistroPosicion
            tipoInicial={registro.tipo}
            previos={registro.previos}
            mercado={estadoMercado.tipo === 'listo' ? estadoMercado.mercado : null}
            onCerrar={() => setRegistro(null)}
            onVolver={registro.desdeGuia && registro.tipo ? () => { setVolverAGuia(registro.tipo ?? null); setRegistro(null); } : undefined}
          />
        )}
        <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
          {/* Banda editorial full-bleed. Sin Fini (guía §6): el personaje nunca
              va cerca de un dato, y menos en inversiones. */}
          <header data-franja className="pb-1 mb-2">
            <Titulo>Inversiones</Titulo>
            <p className="text-[15px] mt-1" style={{ color: COLORS.inkSoft }}>Con los números de hoy, estas son tus alternativas y cómo hacerlas.</p>
          </header>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Sos <span className="font-bold" style={{ color: pl.strong }}>perfil {perfil.label.toLowerCase()}</span>: {perfil.copy.charAt(0).toLowerCase() + perfil.copy.slice(1)}
          </p>

          <Tabs
            options={[
              { id: 'recos' as Tab, label: 'Alternativas' },
              { id: 'mias' as Tab, label: 'Mis inversiones' },
              { id: 'evolucion' as Tab, label: 'Simular' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'recos' && (
            <RecomendacionesTab
              perfil={perfilId}
              horizonteMeses={horizonteMeses}
              usa={usa}
              posiciones={db.posiciones}
              productosQuiz={productosQuiz}
              sugerencia={sugerencia}
              gastoCercano={gastoCercano}
              objetivoEnDolares={objetivoEnDolares}
              inflacionPersonal={inflacionPersonal}
              objetivos={objetivos}
              reabrir={volverAGuia}
              onReabierto={alReabrirGuia}
              onRegistrar={abrirRegistro}
            />
          )}

          {tab === 'mias' && (
            <MisInversiones
              posiciones={db.posiciones}
              objetivosPorId={objetivosPorId}
              onRegistrar={() => abrirRegistro()}
              legacy={aportes.length > 0 ? (
                <Desplegable titulo={`Registros anteriores (${aportes.length})`}>
                  <p className="text-[14px] leading-snug pb-1" style={{ color: COLORS.inkSoft }}>
                    Son los que cargaste antes, con sólo el monto y el tipo. Podés corregirlos o borrarlos.
                  </p>
                  <div className="flex flex-col">
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
                        {/* Lo que cargaste, en la moneda en que lo cargaste: eso es el hecho y no se convierte. */}
                        <span className="text-[15px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>
                          {monedaDe(a) === 'USD' ? `US$ ${a.monto.toLocaleString('es-AR')}` : fmtMoney(a.monto)}
                        </span>
                        <span className="shrink-0" style={{ color: COLORS.inkFaint }}><IconChevron size={16} /></span>
                      </button>
                    ))}
                  </div>
                </Desplegable>
              ) : null}
            />
          )}

          {tab === 'evolucion' && <Simulador />}

          <AvisoLegal />
        </div>
      </div>
    );
  }

  // ── q1 / q2 / yaInvierte / enQue / bancos comparten el layout del stepper ──
  // Volver: a la pregunta anterior; desde la primera, a donde se entró (la
  // presentación, o el resultado si ya lo había hecho).
  const volverDelCuestionario = () => {
    if (stepIndex > 0) { setPaso(pasos[stepIndex - 1]); return; }
    setPaso(perfilGuardado?.completadoEn ? 'resultado' : 'intro');
  };
  return (
    <div className="px-[22px] pt-6 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto lg:pt-8">
      <BotonVolver onClick={volverDelCuestionario} label={stepIndex > 0 ? 'Pregunta anterior' : 'Volver'} />
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

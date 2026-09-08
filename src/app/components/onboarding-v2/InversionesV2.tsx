import { useEffect, useState } from 'react';
import { ArmarGrupoBtn, COLORS, Chip, Cta, Donut, EstadoConfianza, Monto, Rango, Tabs, Titulo, TituloSeccion, fechaDisplay, fmtMoney, formatThousands, loadV2InversionesPerfil, loadV2InversionesState, parseMoneyInput, saveV2InversionesState } from './shared';
import { IconChevron, IconClose, IconMas } from './FinaIcons';

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
type Aporte = { id: string; monto: number; instrumentoId: string; ts: number };
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
  const [modoEvolucion, setModoEvolucion] = useState<'real' | 'simulador'>('real');
  // OJO: el toggle Pesos/USD que había acá no hacía nada — `monedaInv` se
  // guardaba pero no se leía en ningún lado, así que no cambiaba un solo valor
  // en pantalla. Un control que promete algo y no lo cumple es peor que uno
  // ausente, así que se saca de la UI. El valor guardado se conserva tal cual
  // para no pisar datos de quien ya lo tocó, hasta que se cablee de verdad.
  const monedaInv = persistido?.monedaInv;

  // Instrumento abierto en el detalle. Reemplaza al viejo set `expandido`, que
  // desplegaba el "por qué" dentro de la propia fila y hacía crecer la lista.
  const [detalle, setDetalle] = useState<Instrumento | null>(null);
  useEffect(() => {
    if (!detalle) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetalle(null); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [detalle]);

  const [aportes, setAportes] = useState<Aporte[]>(() => persistido?.aportes ?? []);
  const [aporteMonto, setAporteMonto] = useState('');
  const [aporteInstrId, setAporteInstrId] = useState<string>(INSTRUMENTOS[0].id);

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

  function agregarAporte() {
    const monto = parseMoneyInput(aporteMonto);
    if (monto <= 0) return;
    setAportes((a) => [{ id: String(Date.now()), monto, instrumentoId: aporteInstrId, ts: Date.now() }, ...a]);
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
    const totalAportado = aportes.reduce((s, a) => s + a.monto, 0);
    const nombreInstr = (id: string) => INSTRUMENTOS.find((i) => i.id === id)?.nombre ?? id;
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

    return (
      <div className="pb-6">
        {modalDetalle}
        <div className="px-[22px] pt-8 flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
          {/* Banda editorial full-bleed. Sin Fini (guía §6): el personaje nunca
              va cerca de un dato, y menos en inversiones. */}
          <header className="pb-1">
            <Titulo>Inversiones</Titulo>
            <p className="text-[15px] mt-1" style={{ color: COLORS.inkSoft }}>Según tu perfil, esto es lo que te conviene.</p>
          </header>
          {/* El perfil, en una línea. Antes eran tres elementos separados —
              pastilla de color, toggle de moneda y una frase suelta debajo —
              para decir una sola cosa. */}
          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Sos <span className="font-bold" style={{ color: pl.strong }}>perfil {perfil.label.toLowerCase()}</span>: {perfil.copy.charAt(0).toLowerCase() + perfil.copy.slice(1)}
          </p>

          <Tabs
            options={[
              { id: 'recos' as Tab, label: 'Recomendaciones' },
              { id: 'mias' as Tab, label: 'Mis inversiones' },
              { id: 'evolucion' as Tab, label: 'Mi evolución' },
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
                    pct: totalAportado > 0 ? (aportes.filter((a) => a.instrumentoId === i.id).reduce((s, a) => s + a.monto, 0) / totalAportado) * 100 : 0,
                  }))}
                  centerLabel="Invertido"
                  centerValue={fmtMoney(totalAportado)}
                  size={100}
                />
                <div className="flex-1 flex flex-col gap-1.5">
                  <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Vas registrando lo que ponés en cada instrumento acá abajo.</p>
                  {/* Lo invertido es lo que la persona cargó: dato declarado (§5). */}
                  <EstadoConfianza estado="declarado" />
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <TituloSeccion>Registrar un aporte</TituloSeccion>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENTOS.map((i) => (
                    <Chip key={i.id} on={aporteInstrId === i.id} onClick={() => setAporteInstrId(i.id)}>{i.nombre}</Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="v2-focus flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[15px] font-['IBM_Plex_Mono'] tabular-nums outline-none border transition-colors"
                    style={{ background: COLORS.surface, color: COLORS.ink, borderColor: COLORS.lineStrong }}
                    placeholder="Monto"
                    inputMode="decimal"
                    value={aporteMonto}
                    onChange={(e) => setAporteMonto(formatThousands(e.target.value))}
                  />
                  <button type="button" onClick={agregarAporte} disabled={parseMoneyInput(aporteMonto) <= 0} aria-label="Registrar aporte" className="v2-focus rounded-xl w-12 flex items-center justify-center text-white v2-disabled transition-all duration-100 active:scale-95 shrink-0" style={{ background: COLORS.brand }}><IconMas size={20} /></button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {aportes.length === 0 && <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste aportes.</p>}
                {aportes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[15px] truncate" style={{ color: COLORS.ink }}>{nombreInstr(a.instrumentoId)}</span>
                      <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>{fechaDisplay(a.ts)}</span>
                    </span>
                    <Monto value={a.monto} className="text-[15px] font-semibold shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'evolucion' && (
            <div className="flex flex-col gap-3">
              <Tabs
                options={[
                  { id: 'real' as const, label: 'Mis aportes' },
                  { id: 'simulador' as const, label: 'Simular' },
                ]}
                value={modoEvolucion}
                onChange={setModoEvolucion}
              />
              {modoEvolucion === 'real'
                ? <Evolucion aportes={aportes} tasaMensual={perfil.tasaMensual} />
                : <Simulador tasaMensual={perfil.tasaMensual} />}
            </div>
          )}
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

// Línea de tiempo simple: lo aportado de verdad vs una proyección ilustrativa
// a la tasa mensual del perfil (mismo criterio "orientativo" que el resto
// de la app real — nunca una promesa de rendimiento). Diseño claro de FINA.
function Evolucion({ aportes, tasaMensual }: { aportes: Aporte[]; tasaMensual: number }) {
  const ordenado = [...aportes].reverse();
  if (ordenado.length === 0) {
    return (
      <div className="rounded-2xl p-5 text-center border border-dashed" style={{ borderColor: COLORS.lineStrong }}>
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Registrá algún aporte en "Mis inversiones" para ver tu evolución acá.</p>
      </div>
    );
  }
  let acumReal = 0;
  const real = ordenado.map((a) => (acumReal += a.monto));
  let acumProy = 0;
  const proyectado = ordenado.map((a) => { acumProy = (acumProy + a.monto) * (1 + tasaMensual); return acumProy; });
  const max = Math.max(...real, ...proyectado, 1);
  const w = 280, h = 130, pad = 10;
  const xy = (arr: number[], i: number) => {
    const x = pad + (arr.length > 1 ? (i / (arr.length - 1)) * (w - 2 * pad) : (w - 2 * pad) / 2);
    const y = h - pad - (arr[i] / max) * (h - 2 * pad);
    return [x, y] as const;
  };
  const pathReal = real.map((_, i) => xy(real, i).join(',')).join(' ');
  const pathProy = proyectado.map((_, i) => xy(proyectado, i).join(',')).join(' ');
  // Aportado = dato declarado (línea llena, neutral). Proyección = estimado
  // (línea PUNTEADA, guía §5.1): el trazo, no el color, dice la confianza.
  const realColor = COLORS.ink;
  const proyColor = COLORS.brand;

  return (
    <div className={BLOQUE}>
      <TituloSeccion>Tu evolución</TituloSeccion>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]">
        <polyline points={pathProy} fill="none" stroke={proyColor} strokeWidth="3" strokeDasharray="2 4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pathReal} fill="none" stroke={realColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Puntos: sin esto, un solo aporte no dibuja nada (una polyline de 1 punto no se ve). */}
        {proyectado.map((_, i) => { const [x, y] = xy(proyectado, i); return <circle key={`p${i}`} cx={x} cy={y} r="3.5" fill={proyColor} stroke={COLORS.surface} strokeWidth="1.5" />; })}
        {real.map((_, i) => { const [x, y] = xy(real, i); return <circle key={`r${i}`} cx={x} cy={y} r="3.5" fill={realColor} stroke={COLORS.surface} strokeWidth="1.5" />; })}
      </svg>
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: realColor }} /> Aportado real</span>
        <span className="flex items-center gap-1.5 text-[14px]" style={{ color: COLORS.inkSoft }}><span className="w-4 h-0.5 rounded-full" style={{ background: proyColor }} /> Proyección estimada</span>
      </div>
      <p className="text-[12px]" style={{ color: COLORS.inkFaint }}>Proyección ilustrativa a tu perfil — no es una promesa de rendimiento.</p>
    </div>
  );
}

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
// plazo que la persona inventa, no con aportes reales — por eso el
// disclaimer es todavía más explícito que en "Mis aportes".
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

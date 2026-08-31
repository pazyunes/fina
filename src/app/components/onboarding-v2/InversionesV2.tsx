import { useEffect, useState } from 'react';
import { Chip, Coachmark, Cta, Donut, COLORS, fechaDisplay, fmtMoney, formatThousands, parseMoneyInput, loadV2InversionesPerfil, loadV2InversionesState, saveV2InversionesState } from './shared';

// REDISEÑO v2 — Inversiones. La clave es la personalización (pedido
// explícito): un mini-quiz corto arma un perfil de riesgo real (no fijo),
// pregunta si ya invertís (y en qué) y qué bancos/billeteras usás — y con
// eso arma recomendaciones que tienen en cuenta lo que ya hacés y desde
// dónde lo podés hacer. Mismo catálogo/lógica que InversionesPage.tsx de
// la app real, adaptado a este sandbox sin backend.
//
// Una vez armado el perfil, la pantalla se divide en 3 (pedido explícito):
// Mis inversiones / Recomendaciones / Mi evolución — y ahí sí, la sección
// pasa a modo oscuro (Cleo/Nubank): el número manda, cero ruido de color.
// El quiz en sí (antes de llegar al resultado) se queda en el mismo
// lenguaje claro que el resto de la app.

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

type Instrumento = { id: string; nombre: string; desc: string; riesgo: 'Bajo' | 'Medio' | 'Alto'; apps: string[]; perfiles: PerfilId[] };
const INSTRUMENTOS: Instrumento[] = [
  { id: 'cuenta_remunerada', nombre: 'Cuenta remunerada', desc: 'Tu plata rinde todos los días y la sacás cuando quieras.', riesgo: 'Bajo', apps: ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank'], perfiles: ['conservador', 'moderado', 'arriesgado'] },
  { id: 'plazo_fijo', nombre: 'Plazo fijo UVA', desc: 'Dejás la plata quieta un tiempo y sigue la inflación.', riesgo: 'Bajo', apps: ['Banco tradicional', 'Mercado Pago', 'Ualá'], perfiles: ['conservador', 'moderado'] },
  { id: 'fci', nombre: 'Fondo Común de Inversión', desc: 'Un equipo profesional invierte por vos, retiro rápido.', riesgo: 'Medio', apps: ['Mercado Pago', 'Ualá', 'Naranja X', 'Brubank'], perfiles: ['moderado', 'arriesgado'] },
  { id: 'dolar_mep', nombre: 'Dólar MEP', desc: 'Protegés lo ahorrado de la devaluación.', riesgo: 'Medio', apps: ['Banco tradicional', 'Brubank'], perfiles: ['moderado', 'arriesgado'] },
  { id: 'cedears', nombre: 'CEDEARs', desc: 'Pedacitos de empresas grandes del exterior, en pesos.', riesgo: 'Alto', apps: ['Banco tradicional'], perfiles: ['arriesgado'] },
];

const PERFILES: Record<PerfilId, { label: string; emoji: string; accent: string; copy: string; tasaMensual: number }> = {
  conservador: { label: 'Conservador', emoji: '🌱', accent: '#34D399', copy: 'Preferís cuidar lo que tenés antes que arriesgar de más.', tasaMensual: 0.008 },
  moderado: { label: 'Moderado', emoji: '🌿', accent: '#F5B94D', copy: 'Buscás un equilibrio entre seguridad y crecimiento.', tasaMensual: 0.015 },
  arriesgado: { label: 'Arriesgado', emoji: '🚀', accent: '#FF8FA3', copy: 'Te bancás más vaivén a cambio de más potencial de crecimiento.', tasaMensual: 0.025 },
};

type Aporte = { id: string; monto: number; instrumentoId: string; ts: number };
type PersistidoInv = {
  completado: boolean; // llegó a la pantalla de resultado alguna vez
  porQue: string | null;
  reaccion: string | null;
  yaInvierte: 'si' | 'no' | null;
  enQue: string[];
  bancos: string[];
  aportes: Aporte[];
};

const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-3 text-[15px] bg-white outline-none transition-colors';

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
  const [yaInvierte, setYaInvierte] = useState<'si' | 'no' | null>(() => persistido?.yaInvierte ?? null);
  const [enQue, setEnQue] = useState<string[]>(() => persistido?.enQue ?? []);
  const [bancos, setBancos] = useState<string[]>(() => persistido?.bancos ?? []);
  const [tab, setTab] = useState<Tab>('recos');
  const [modoEvolucion, setModoEvolucion] = useState<'real' | 'simulador'>('real');

  const [aportes, setAportes] = useState<Aporte[]>(() => persistido?.aportes ?? []);
  const [aporteMonto, setAporteMonto] = useState('');
  const [aporteInstrId, setAporteInstrId] = useState<string>(INSTRUMENTOS[0].id);

  useEffect(() => {
    saveV2InversionesState({ completado: paso === 'resultado', porQue, reaccion, yaInvierte, enQue, bancos, aportes });
  }, [paso, porQue, reaccion, yaInvierte, enQue, bancos, aportes]);

  const pasos: Paso[] = [
    ...(prefilledPerfil ? [] : (['q1', 'q2'] as Paso[])),
    'yaInvierte',
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
    if (porQue === 'Para sacarla pronto') score -= 0.5;
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

  // ── intro ──
  if (paso === 'intro') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Inversiones</h1>
        <Coachmark id="inversiones">Acá vas a poder armar tu perfil de riesgo y ver qué opciones tienen sentido para vos — nunca movemos tu plata, solo te orientamos.</Coachmark>
        <button
          type="button"
          onClick={() => setPaso(pasos[0])}
          className="text-left bg-white rounded-2xl p-5 shadow-[0_2px_18px_rgba(31,27,46,0.07)] flex flex-col gap-2 transition-transform duration-100 active:scale-[0.99]"
        >
          <span className="text-[18px] font-bold" style={{ color: COLORS.ink }}>Averiguá tu perfil de inversor</span>
          <span className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>
            {prefilledPerfil
              ? 'Ya nos contaste algo de esto en el onboarding — te faltan un par de preguntas más.'
              : '2 minutos, para que las recomendaciones tengan que ver con vos — sin comprometerte a nada.'}
          </span>
          <span className="self-end text-[20px]" style={{ color: COLORS.brand }}>→</span>
        </button>
      </div>
    );
  }

  // ── resultado: perfil + 3 pestañas, en modo oscuro ──
  if (paso === 'resultado') {
    const totalAportado = aportes.reduce((s, a) => s + a.monto, 0);
    const nombreInstr = (id: string) => INSTRUMENTOS.find((i) => i.id === id)?.nombre ?? id;

    return (
      <div style={{ background: COLORS.dark, minHeight: '100%' }} className="pb-6">
        <div className="px-[22px] pt-8 flex flex-col gap-4">
          <span
            className="self-start flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold"
            style={{ background: `${perfil.accent}26`, color: perfil.accent }}
          >
            {perfil.emoji} Perfil {perfil.label.toLowerCase()}
          </span>
          <p className="text-[13.5px] -mt-2" style={{ color: COLORS.onDarkSoft }}>{perfil.copy}</p>

          <div className="flex gap-1.5 rounded-2xl p-1" style={{ background: COLORS.darkCard }}>
            {([
              ['recos', 'Recomendaciones'],
              ['mias', 'Mis inversiones'],
              ['evolucion', 'Mi evolución'],
            ] as [Tab, string][]).map(([id, label]) => {
              const sel = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors duration-150"
                  style={sel ? { background: COLORS.brand, color: '#fff' } : { color: COLORS.onDarkSoft }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === 'recos' && (
            <div className="flex flex-col gap-3">
              {enQue.length > 0 && (
                <div className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: 'rgba(52,211,153,0.14)', color: '#34D399' }}>
                  Ya invertís en {enQue.join(', ')} — priorizamos otras opciones para diversificar.
                </div>
              )}
              {recomendados.map((r) => {
                const bancoMatch = bancos.find((b) => r.apps.includes(b));
                const already = yaEnIds.has(r.id);
                return (
                  <div key={r.id} className="rounded-2xl p-4" style={{ background: COLORS.darkCard, opacity: already ? 0.6 : 1 }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[14.5px]" style={{ color: COLORS.onDark }}>{r.nombre}</p>
                      <span className="text-[10.5px] font-semibold rounded-full px-2 py-0.5 shrink-0" style={{ background: 'rgba(244,241,250,0.1)', color: COLORS.onDarkSoft }}>{r.riesgo} riesgo</span>
                    </div>
                    {bancoMatch ? (
                      <p className="text-[12.5px] font-semibold mt-1" style={{ color: '#34D399' }}>✓ Desde tu {bancoMatch}</p>
                    ) : (
                      <p className="text-[12.5px] mt-1" style={{ color: COLORS.onDarkSoft }}>{r.desc}</p>
                    )}
                    {already && <p className="text-[11.5px] font-semibold mt-1" style={{ color: COLORS.onDarkSoft }}>Ya lo hacés ✓</p>}
                  </div>
                );
              })}
              <p className="text-[11px] px-1" style={{ color: COLORS.onDarkSoft }}>Esto es orientativo y no reemplaza asesoramiento financiero. FINA no mueve tu plata.</p>
            </div>
          )}

          {tab === 'mias' && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl p-4 flex gap-4 items-center" style={{ background: COLORS.darkCard }}>
                <Donut
                  dark
                  segments={INSTRUMENTOS.map((i) => ({
                    color: i.riesgo === 'Bajo' ? '#34D399' : i.riesgo === 'Medio' ? '#F5B94D' : '#FF8FA3',
                    pct: totalAportado > 0 ? (aportes.filter((a) => a.instrumentoId === i.id).reduce((s, a) => s + a.monto, 0) / totalAportado) * 100 : 0,
                  }))}
                  centerLabel="Invertido"
                  centerValue={fmtMoney(totalAportado)}
                  size={100}
                />
                <p className="flex-1 text-[13px]" style={{ color: COLORS.onDarkSoft }}>Vas registrando lo que ponés en cada instrumento acá abajo.</p>
              </div>

              <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: COLORS.darkCard }}>
                <p className="text-[13px] font-bold" style={{ color: COLORS.onDark }}>Registrar un aporte</p>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENTOS.map((i) => (
                    <Chip key={i.id} on={aporteInstrId === i.id} onClick={() => setAporteInstrId(i.id)}>{i.nombre}</Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl px-3 py-2 text-[13.5px] font-['IBM_Plex_Mono'] tabular-nums outline-none"
                    style={{ background: 'rgba(244,241,250,0.08)', color: COLORS.onDark }}
                    placeholder="Monto"
                    inputMode="numeric"
                    value={aporteMonto}
                    onChange={(e) => setAporteMonto(formatThousands(e.target.value))}
                  />
                  <button type="button" onClick={agregarAporte} disabled={parseMoneyInput(aporteMonto) <= 0} className="rounded-xl px-4 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95" style={{ background: COLORS.brand }}>+</button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {aportes.length === 0 && <p className="text-[13px]" style={{ color: COLORS.onDarkSoft }}>Todavía no registraste aportes.</p>}
                {aportes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ background: COLORS.darkCard }}>
                    <span className="text-[13.5px]" style={{ color: COLORS.onDark }}>{nombreInstr(a.instrumentoId)} · {fechaDisplay(a.ts)}</span>
                    <span className="font-['IBM_Plex_Mono'] font-semibold text-[13.5px] tabular-nums" style={{ color: COLORS.onDark }}>{fmtMoney(a.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'evolucion' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-1.5 rounded-2xl p-1" style={{ background: COLORS.darkCard }}>
                {(['real', 'simulador'] as const).map((m) => {
                  const sel = modoEvolucion === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModoEvolucion(m)}
                      className="flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors duration-150"
                      style={sel ? { background: COLORS.brand, color: '#fff' } : { color: COLORS.onDarkSoft }}
                    >
                      {m === 'real' ? 'Mis aportes' : 'Simular'}
                    </button>
                  );
                })}
              </div>
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
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <div className="flex justify-center gap-2">
        {pasos.map((p, i) => (
          <span key={p} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= stepIndex ? COLORS.brand : 'rgba(31,27,46,0.14)' }} />
        ))}
      </div>

      {paso === 'q1' && (
        <>
          <h1 className="text-[20px] font-bold" style={{ color: COLORS.ink }}>¿Por qué querés invertir?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Para sacarla pronto', 'Para mantenerla en otro lado'].map((o) => (
              <Chip key={o} on={porQue === o} onClick={() => setPorQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'q2' && (
        <>
          <h1 className="text-[20px] font-bold" style={{ color: COLORS.ink }}>Si lo que invertiste baja 20%, ¿qué hacés?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
              <Chip key={o} on={reaccion === o} onClick={() => setReaccion(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'yaInvierte' && (
        <>
          <h1 className="text-[20px] font-bold" style={{ color: COLORS.ink }}>¿Ya invertís hoy en algo?</h1>
          <div className="flex flex-wrap gap-2.5">
            {(['si', 'no'] as const).map((o) => (
              <Chip key={o} on={yaInvierte === o} onClick={() => setYaInvierte(o)}>{o === 'si' ? 'Sí' : 'No'}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'enQue' && (
        <>
          <h1 className="text-[20px] font-bold" style={{ color: COLORS.ink }}>¿En qué invertís?</h1>
          <div className="flex flex-wrap gap-2.5">
            {EN_QUE_OPCIONES.map((o) => (
              <Chip key={o} on={enQue.includes(o)} onClick={() => toggleEnQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'bancos' && (
        <>
          <h1 className="text-[20px] font-bold" style={{ color: COLORS.ink }}>¿Qué bancos o billeteras usás?</h1>
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Así te decimos exactamente desde dónde hacerlo.</p>
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
// de la app real — nunca una promesa de rendimiento). Vive en modo oscuro,
// como el resto del resultado.
function Evolucion({ aportes, tasaMensual }: { aportes: Aporte[]; tasaMensual: number }) {
  const ordenado = [...aportes].reverse();
  if (ordenado.length === 0) {
    return (
      <div className="rounded-2xl p-5 text-center border border-dashed" style={{ borderColor: COLORS.darkLine }}>
        <p className="text-[13.5px]" style={{ color: COLORS.onDarkSoft }}>Registrá algún aporte en "Mis inversiones" para ver tu evolución acá.</p>
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
  const realColor = '#34D399';
  const proyColor = '#F5B94D';

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.darkCard }}>
      <p className="text-[13px] font-bold" style={{ color: COLORS.onDark }}>Tu evolución</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]">
        <polyline points={pathProy} fill="none" stroke={proyColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pathReal} fill="none" stroke={realColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Puntos: sin esto, un solo aporte no dibuja nada (una polyline de 1 punto no se ve). */}
        {proyectado.map((_, i) => { const [x, y] = xy(proyectado, i); return <circle key={`p${i}`} cx={x} cy={y} r="3.5" fill={proyColor} stroke={COLORS.dark} strokeWidth="1.5" />; })}
        {real.map((_, i) => { const [x, y] = xy(real, i); return <circle key={`r${i}`} cx={x} cy={y} r="3.5" fill={realColor} stroke={COLORS.dark} strokeWidth="1.5" />; })}
      </svg>
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.onDarkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: realColor }} /> Aportado real</span>
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.onDarkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: proyColor }} /> Proyección estimada</span>
      </div>
      <p className="text-[11px]" style={{ color: COLORS.onDarkSoft }}>Proyección ilustrativa a tu perfil — no es una promesa de rendimiento.</p>
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
  for (let i = 0; i < meses; i++) {
    acumAp += montoNum;
    acumProy = (acumProy + montoNum) * (1 + tasaMensual);
    serieAportado.push(acumAp);
    serieProyectado.push(acumProy);
  }
  const max = Math.max(...serieAportado, ...serieProyectado, 1);
  const w = 280, h = 130, pad = 10;
  const totalAportado = serieAportado[serieAportado.length - 1] ?? 0;
  const totalProyectado = serieProyectado[serieProyectado.length - 1] ?? 0;
  const realColor = '#34D399';
  const proyColor = '#F5B94D';

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: COLORS.darkCard }}>
      <p className="text-[13px] font-bold" style={{ color: COLORS.onDark }}>Probá antes de invertir plata real</p>
      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 left-3" style={{ color: COLORS.onDarkSoft }}>$</span>
        <input
          className="w-full rounded-xl pl-7 pr-3 py-2.5 text-[13.5px] font-['IBM_Plex_Mono'] tabular-nums outline-none"
          style={{ background: 'rgba(244,241,250,0.08)', color: COLORS.onDark }}
          placeholder="Cuánto pondrías por mes"
          inputMode="numeric"
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
              className="flex-1 rounded-xl py-2 text-[12.5px] font-semibold transition-all duration-100 active:scale-95"
              style={sel ? { background: COLORS.brand, color: '#fff' } : { background: 'rgba(244,241,250,0.08)', color: COLORS.onDarkSoft }}
            >
              {m} meses
            </button>
          );
        })}
      </div>

      {montoNum > 0 && (
        <>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]">
            <polyline points={serieAPath(serieProyectado, w, h, pad, max)} fill="none" stroke={proyColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={serieAPath(serieAportado, w, h, pad, max)} fill="none" stroke={realColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.onDarkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: realColor }} /> Pondrías</span>
            <span className="flex items-center gap-1.5 text-[12px]" style={{ color: COLORS.onDarkSoft }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: proyColor }} /> Tendrías (estimado)</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(244,241,250,0.06)' }}>
              <p className="text-[11px]" style={{ color: COLORS.onDarkSoft }}>En {meses} meses pondrías</p>
              <p className="font-['IBM_Plex_Mono'] font-bold text-[15px] tabular-nums" style={{ color: COLORS.onDark }}>{fmtMoney(totalAportado)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(244,241,250,0.06)' }}>
              <p className="text-[11px]" style={{ color: COLORS.onDarkSoft }}>Podrías tener</p>
              <p className="font-['IBM_Plex_Mono'] font-bold text-[15px] tabular-nums" style={{ color: proyColor }}>{fmtMoney(totalProyectado)}</p>
            </div>
          </div>
        </>
      )}
      <p className="text-[11px]" style={{ color: COLORS.onDarkSoft }}>Es una simulación con números inventados — no es una promesa de rendimiento ni mueve plata real.</p>
    </div>
  );
}

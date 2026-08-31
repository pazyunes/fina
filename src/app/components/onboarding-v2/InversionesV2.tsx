import { useState } from 'react';
import { Chip, Cta, Donut, COLORS, fmtMoney, formatThousands, parseMoneyInput, loadV2InversionesPerfil } from './shared';

// REDISEÑO v2 — Inversiones. La clave es la personalización (pedido
// explícito): un mini-quiz corto arma un perfil de riesgo real (no fijo),
// pregunta si ya invertís (y en qué) y qué bancos/billeteras usás — y con
// eso arma recomendaciones que tienen en cuenta lo que ya hacés y desde
// dónde lo podés hacer. Mismo catálogo/lógica que InversionesPage.tsx de
// la app real, adaptado a este sandbox sin backend.
//
// Una vez armado el perfil, la pantalla se divide en 3 (pedido explícito):
// Mis inversiones / Recomendaciones / Mi evolución.

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

const PERFILES: Record<PerfilId, { label: string; emoji: string; color: string; copy: string; tasaMensual: number }> = {
  conservador: { label: 'Conservador', emoji: '🌱', color: COLORS.mintLight, copy: 'Preferís cuidar lo que tenés antes que arriesgar de más.', tasaMensual: 0.008 },
  moderado: { label: 'Moderado', emoji: '🌿', color: COLORS.yellowSoft, copy: 'Buscás un equilibrio entre seguridad y crecimiento.', tasaMensual: 0.015 },
  arriesgado: { label: 'Arriesgado', emoji: '🚀', color: COLORS.coralSoft, copy: 'Te bancás más vaivén a cambio de más potencial de crecimiento.', tasaMensual: 0.025 },
};

type Aporte = { id: string; monto: number; instrumentoId: string; fecha: string };
const hoy = () => new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

export function InversionesV2() {
  // Si en el onboarding ya contestó el mini-perfil, arrancamos directo desde
  // "¿ya invertís?" en vez de repreguntar por qué invierte / cómo reacciona.
  const [prefilledPerfil] = useState(() => !!loadV2InversionesPerfil());
  const [paso, setPaso] = useState<Paso>('intro');
  const [porQue, setPorQue] = useState<string | null>(() => loadV2InversionesPerfil()?.porQue || null);
  const [reaccion, setReaccion] = useState<string | null>(() => loadV2InversionesPerfil()?.reaccion || null);
  const [yaInvierte, setYaInvierte] = useState<'si' | 'no' | null>(null);
  const [enQue, setEnQue] = useState<string[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('recos');

  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [aporteMonto, setAporteMonto] = useState('');
  const [aporteInstrId, setAporteInstrId] = useState<string>(INSTRUMENTOS[0].id);

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
    setAportes((a) => [{ id: String(Date.now()), monto, instrumentoId: aporteInstrId, fecha: hoy() }, ...a]);
    setAporteMonto('');
  }

  // ── intro ──
  if (paso === 'intro') {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4">
        <h1 className="font-['Baloo_2'] text-[22px] font-bold text-[#1E1E1E]">Inversiones</h1>
        <button
          type="button"
          onClick={() => setPaso(pasos[0])}
          className="text-left bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-5 shadow-[4px_4px_0_#1E1E1E] flex flex-col gap-2"
        >
          <span className="font-['Baloo_2'] text-[18px] font-bold text-[#1E1E1E]">Averiguá tu perfil de inversor</span>
          <span className="text-[13.5px] text-[#5b5b52]">
            {prefilledPerfil
              ? 'Ya nos contaste algo de esto en el onboarding — te faltan un par de preguntas más.'
              : '2 minutos, para que las recomendaciones tengan que ver con vos — sin comprometerte a nada.'}
          </span>
          <span className="self-end text-[20px]">→</span>
        </button>
      </div>
    );
  }

  // ── resultado: perfil + 3 pestañas ──
  if (paso === 'resultado') {
    const totalAportado = aportes.reduce((s, a) => s + a.monto, 0);
    const nombreInstr = (id: string) => INSTRUMENTOS.find((i) => i.id === id)?.nombre ?? id;

    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
        <span className="self-start flex items-center gap-1.5 rounded-full border-2 border-[#1E1E1E] px-3 py-1 text-[12.5px] font-bold" style={{ background: perfil.color }}>
          {perfil.emoji} Perfil {perfil.label.toLowerCase()}
        </span>
        <p className="text-[13.5px] text-[#5b5b52] -mt-2">{perfil.copy}</p>

        <div className="flex gap-1.5 bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-1">
          {([
            ['recos', 'Recomendaciones'],
            ['mias', 'Mis inversiones'],
            ['evolucion', 'Mi evolución'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="flex-1 rounded-xl py-2 text-[12px] font-bold"
              style={{ background: tab === id ? COLORS.mint : 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'recos' && (
          <div className="flex flex-col gap-3">
            {enQue.length > 0 && (
              <div className="rounded-xl border-2 border-[#1E1E1E] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: COLORS.mintLight }}>
                🎯 Ya invertís en {enQue.join(', ')} — priorizamos otras opciones para diversificar.
              </div>
            )}
            {recomendados.map((r) => {
              const bancoMatch = bancos.find((b) => r.apps.includes(b));
              const already = yaEnIds.has(r.id);
              return (
                <div key={r.id} className={`bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-4 ${already ? 'opacity-70' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[14.5px] text-[#1E1E1E]">{r.nombre}</p>
                    <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.yellowSoft }}>{r.riesgo} riesgo</span>
                  </div>
                  {bancoMatch ? (
                    <p className="text-[12.5px] font-semibold text-[#1E1E1E] mt-1">✓ Desde tu {bancoMatch}</p>
                  ) : (
                    <p className="text-[12.5px] text-[#5b5b52] mt-1">{r.desc}</p>
                  )}
                  {already && <p className="text-[11.5px] font-semibold text-[#5b5b52] mt-1">Ya lo hacés ✓</p>}
                </div>
              );
            })}
            <p className="text-[11px] text-[#5b5b52] px-1">Esto es orientativo y no reemplaza asesoramiento financiero. FINA no mueve tu plata.</p>
          </div>
        )}

        {tab === 'mias' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 flex gap-4 items-center shadow-[4px_4px_0_#1E1E1E]">
              <Donut
                segments={INSTRUMENTOS.map((i) => ({
                  color: i.riesgo === 'Bajo' ? COLORS.mint : i.riesgo === 'Medio' ? COLORS.yellow : COLORS.coral,
                  pct: totalAportado > 0 ? (aportes.filter((a) => a.instrumentoId === i.id).reduce((s, a) => s + a.monto, 0) / totalAportado) * 100 : 0,
                }))}
                centerLabel="Invertido"
                centerValue={fmtMoney(totalAportado)}
                size={100}
              />
              <p className="flex-1 text-[13px] text-[#5b5b52]">Vas registrando lo que ponés en cada instrumento acá abajo.</p>
            </div>

            <div className="bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-2.5">
              <p className="text-[13px] font-bold text-[#1E1E1E]">Registrar un aporte</p>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTOS.map((i) => (
                  <Chip key={i.id} on={aporteInstrId === i.id} onClick={() => setAporteInstrId(i.id)}>{i.nombre}</Chip>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13.5px] outline-none"
                  placeholder="Monto"
                  inputMode="numeric"
                  value={aporteMonto}
                  onChange={(e) => setAporteMonto(formatThousands(e.target.value))}
                />
                <button type="button" onClick={agregarAporte} disabled={parseMoneyInput(aporteMonto) <= 0} className="rounded-xl border-2 border-[#1E1E1E] px-4 font-bold disabled:opacity-40" style={{ background: COLORS.mint }}>+</button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {aportes.length === 0 && <p className="text-[13px] text-[#5b5b52]">Todavía no registraste aportes.</p>}
              {aportes.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-white border-[2px] border-[#1E1E1E] rounded-xl px-3.5 py-2.5">
                  <span className="text-[13.5px] text-[#1E1E1E]">{nombreInstr(a.instrumentoId)} · {a.fecha}</span>
                  <span className="font-semibold text-[13.5px]">{fmtMoney(a.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'evolucion' && <Evolucion aportes={aportes} tasaMensual={perfil.tasaMensual} />}
      </div>
    );
  }

  // ── q1 / q2 / yaInvierte / enQue / bancos comparten el layout del stepper ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <div className="flex justify-center gap-2">
        {pasos.map((p, i) => (
          <span key={p} className="w-2.5 h-2.5 rounded-full border-2 border-[#1E1E1E]" style={{ background: i <= stepIndex ? COLORS.mint : '#fff' }} />
        ))}
      </div>

      {paso === 'q1' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿Por qué querés invertir?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Para sacarla pronto', 'Para mantenerla en otro lado'].map((o) => (
              <Chip key={o} on={porQue === o} onClick={() => setPorQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'q2' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">Si lo que invertiste baja 20%, ¿qué hacés?</h1>
          <div className="flex flex-wrap gap-2.5">
            {['Lo saco todo', 'Lo dejo y espero', 'Pongo más'].map((o) => (
              <Chip key={o} on={reaccion === o} onClick={() => setReaccion(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'yaInvierte' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿Ya invertís hoy en algo?</h1>
          <div className="flex flex-wrap gap-2.5">
            {(['si', 'no'] as const).map((o) => (
              <Chip key={o} on={yaInvierte === o} onClick={() => setYaInvierte(o)}>{o === 'si' ? 'Sí' : 'No'}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'enQue' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿En qué invertís?</h1>
          <div className="flex flex-wrap gap-2.5">
            {EN_QUE_OPCIONES.map((o) => (
              <Chip key={o} on={enQue.includes(o)} onClick={() => toggleEnQue(o)}>{o}</Chip>
            ))}
          </div>
        </>
      )}

      {paso === 'bancos' && (
        <>
          <h1 className="font-['Baloo_2'] text-[20px] font-bold text-[#1E1E1E]">¿Qué bancos o billeteras usás?</h1>
          <p className="text-[13px] text-[#5b5b52]">Así te decimos exactamente desde dónde hacerlo.</p>
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
// de la app real — nunca una promesa de rendimiento).
function Evolucion({ aportes, tasaMensual }: { aportes: Aporte[]; tasaMensual: number }) {
  const ordenado = [...aportes].reverse();
  if (ordenado.length === 0) {
    return (
      <div className="bg-white border-[2.5px] border-dashed border-[#1E1E1E] rounded-2xl p-5 text-center">
        <p className="text-[13.5px] text-[#5b5b52]">Registrá algún aporte en "Mis inversiones" para ver tu evolución acá.</p>
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

  return (
    <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-3 shadow-[4px_4px_0_#1E1E1E]">
      <p className="text-[13px] font-bold text-[#1E1E1E]">Tu evolución</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[130px]">
        <polyline points={pathProy} fill="none" stroke={COLORS.yellow} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pathReal} fill="none" stroke={COLORS.mint} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Puntos: sin esto, un solo aporte no dibuja nada (una polyline de 1 punto no se ve). */}
        {proyectado.map((_, i) => { const [x, y] = xy(proyectado, i); return <circle key={`p${i}`} cx={x} cy={y} r="3.5" fill={COLORS.yellow} stroke={COLORS.ink} strokeWidth="1.5" />; })}
        {real.map((_, i) => { const [x, y] = xy(real, i); return <circle key={`r${i}`} cx={x} cy={y} r="3.5" fill={COLORS.mint} stroke={COLORS.ink} strokeWidth="1.5" />; })}
      </svg>
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5 text-[12px] text-[#5b5b52]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.mint }} /> Aportado real</span>
        <span className="flex items-center gap-1.5 text-[12px] text-[#5b5b52]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.yellow }} /> Proyección estimada</span>
      </div>
      <p className="text-[11px] text-[#5b5b52]">Proyección ilustrativa a tu perfil — no es una promesa de rendimiento.</p>
    </div>
  );
}

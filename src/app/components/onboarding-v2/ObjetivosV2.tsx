import { useState } from 'react';
import { Cta, Chip, Coachmark, COLORS, Donut, SegmentedTab, fmtMoney, formatThousands, parseMoneyInput, loadV2ObjetivosIniciales, loadV2Grupo, loadV2Nombre } from './shared';

// REDISEÑO v2 — Objetivos: mantiene la lógica "oficial" de la app real
// (ver ObjetivosPage.tsx / GoalEditModal.tsx) pasada a la estética nueva —
// un objetivo tiene un monto total y una lista de REGISTROS ("ya lo pagué"
// / "lo separé") que van llenando el donut. Lo que falta = pendiente.
//
// El monto no siempre se sabe de entrada, así que admite 3 modos: un monto
// exacto, un rango (todavía no lo tenés cerrado), o "todavía no sé" (se
// completa más adelante). Solo el estado "nunca contestado" (viene así del
// onboarding cuando se nombra un objetivo sin más datos) se marca como
// Incompleto en rojo — "todavía no sé" es una respuesta válida, no un error.
//
// Si hay un grupo armado (ver GruposV2), un objetivo puede ser grupal: cada
// registro se etiqueta con quién lo hizo, así se ve el aporte de cada una
// aunque todavía no haya cuentas reales sincronizando esto entre celulares.

type Kind = 'paid' | 'saved';
type MontoModo = 'exacto' | 'rango' | 'desconocido';
type TipoObjetivo = 'individual' | 'grupal';
type Contribucion = { id: string; monto: number; kind: Kind; label: string; fecha: string; de: string };
type Objetivo = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoObjetivo;
  montoModo: MontoModo | null; // null = todavía no contestó nada (viene del onboarding)
  montoTotal: number; // para cálculos: el monto exacto, o el máximo del rango; 0 si desconocido/sin definir
  montoMin?: number; // solo si montoModo === 'rango'
  contribuciones: Contribucion[];
};

// Nota Tailwind: la clase completa tiene que aparecer en el archivo (aunque
// sea dentro de este string) para que el scanner de Tailwind la detecte.
const CARD_SHADOW = 'shadow-[0_2px_18px_rgba(31,27,46,0.07)]';
const inputClass = 'border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-xl px-3 py-2.5 text-[14px] outline-none transition-colors';

const hoy = () => new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

function objetivosIniciales(): Objetivo[] {
  return loadV2ObjetivosIniciales().map((nombre, i) => ({
    id: `onb-${i}-${nombre}`,
    nombre,
    descripcion: '',
    tipo: 'individual',
    montoModo: null,
    montoTotal: 0,
    contribuciones: [],
  }));
}

function buildMonto(modo: MontoModo, montoTxt: string, minTxt: string): { montoModo: MontoModo; montoTotal: number; montoMin?: number } {
  if (modo === 'desconocido') return { montoModo: 'desconocido', montoTotal: 0 };
  if (modo === 'rango') {
    const min = parseMoneyInput(minTxt);
    const max = parseMoneyInput(montoTxt);
    return { montoModo: 'rango', montoTotal: max, montoMin: min || undefined };
  }
  return { montoModo: 'exacto', montoTotal: parseMoneyInput(montoTxt) };
}

// 'definido' = tiene un monto (exacto o rango) con el que calcular progreso.
// 'desconocido' = eligió "todavía no sé" a propósito — no es un error.
// 'incompleto' = nunca contestó nada (recién llegó del onboarding).
function estadoMonto(o: Objetivo): 'definido' | 'desconocido' | 'incompleto' {
  if (o.montoModo === 'desconocido') return 'desconocido';
  if (o.montoTotal > 0) return 'definido';
  return 'incompleto';
}

function montoLabel(o: Objetivo): string {
  if (o.montoModo === 'rango' && o.montoMin) return `${fmtMoney(o.montoMin)}–${fmtMoney(o.montoTotal)}`;
  return fmtMoney(o.montoTotal);
}

// Selector de "cómo querés poner el monto" — se reusa al crear un objetivo
// y al completar uno que llegó incompleto desde el onboarding.
function MontoPicker({
  modo, setModo, montoTxt, setMontoTxt, minTxt, setMinTxt,
}: {
  modo: MontoModo; setModo: (m: MontoModo) => void;
  montoTxt: string; setMontoTxt: (v: string) => void;
  minTxt: string; setMinTxt: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {([
          ['exacto', 'Monto exacto'],
          ['rango', 'Un rango'],
          ['desconocido', 'Todavía no sé'],
        ] as [MontoModo, string][]).map(([m, label]) => {
          const sel = modo === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className="rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-100 active:scale-95"
              style={sel ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {modo === 'exacto' && (
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
          <input
            className={`w-full ${inputClass} pl-8`}
            placeholder="¿Cuánto necesitás en total?"
            inputMode="numeric"
            value={montoTxt}
            onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
          />
        </div>
      )}

      {modo === 'rango' && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Desde"
              inputMode="numeric"
              value={minTxt}
              onChange={(e) => setMinTxt(formatThousands(e.target.value))}
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
            <input
              className={`w-full ${inputClass} pl-8`}
              placeholder="Hasta"
              inputMode="numeric"
              value={montoTxt}
              onChange={(e) => setMontoTxt(formatThousands(e.target.value))}
            />
          </div>
        </div>
      )}

      {modo === 'desconocido' && (
        <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Buenísimo — lo vas a poder poner más adelante, cuando lo tengas más claro.</p>
      )}
    </div>
  );
}

export function ObjetivosV2() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>(objetivosIniciales);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoObjetivo>('individual');
  const [montoModo, setMontoModo] = useState<MontoModo>('exacto');
  const [montoTotal, setMontoTotal] = useState('');
  const [montoMinTxt, setMontoMinTxt] = useState('');

  const [kind, setKind] = useState<Kind>('paid');
  const [regLabel, setRegLabel] = useState('');
  const [regMonto, setRegMonto] = useState('');
  const [regDe, setRegDe] = useState('');
  const [montoModoEdit, setMontoModoEdit] = useState<MontoModo>('exacto');
  const [montoTotalEdit, setMontoTotalEdit] = useState('');
  const [montoMinEdit, setMontoMinEdit] = useState('');

  const grupo = loadV2Grupo();
  const miNombre = loadV2Nombre() || 'Vos';

  const abierto = objetivos.find((o) => o.id === openId) || null;

  function crearObjetivo() {
    if (!nombre.trim()) return;
    const id = String(Date.now());
    const monto = buildMonto(montoModo, montoTotal, montoMinTxt);
    setObjetivos((os) => [...os, { id, nombre: nombre.trim(), descripcion: descripcion.trim(), tipo, contribuciones: [], ...monto }]);
    setNombre(''); setDescripcion(''); setMontoTotal(''); setMontoMinTxt(''); setMontoModo('exacto'); setTipo('individual');
    setCreating(false);
    setOpenId(id);
  }

  function borrarObjetivo(id: string) {
    setObjetivos((os) => os.filter((o) => o.id !== id));
    if (openId === id) setOpenId(null);
  }

  function agregarRegistro() {
    if (!abierto) return;
    const monto = parseMoneyInput(regMonto);
    if (monto <= 0) return;
    const nuevo: Contribucion = {
      id: String(Date.now()),
      monto,
      kind,
      label: regLabel.trim() || (kind === 'paid' ? 'Pago' : 'Separado'),
      fecha: hoy(),
      de: abierto.tipo === 'grupal' ? (regDe || miNombre) : miNombre,
    };
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: [nuevo, ...o.contribuciones] } : o)));
    setRegLabel(''); setRegMonto(''); setRegDe('');
  }

  function borrarRegistro(regId: string) {
    if (!abierto) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: o.contribuciones.filter((c) => c.id !== regId) } : o)));
  }

  function completarMontoTotal() {
    if (!abierto) return;
    const monto = buildMonto(montoModoEdit, montoTotalEdit, montoMinEdit);
    if (monto.montoModo !== 'desconocido' && monto.montoTotal <= 0) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, ...monto } : o)));
    setMontoTotalEdit(''); setMontoMinEdit(''); setMontoModoEdit('exacto');
  }

  const saved = (o: Objetivo) => o.contribuciones.reduce((s, c) => s + c.monto, 0);
  const pct = (o: Objetivo) => (o.montoTotal > 0 ? Math.min(Math.round((saved(o) / o.montoTotal) * 100), 100) : 0);

  // ── Vista: detalle de un objetivo ──
  if (abierto) {
    const estado = estadoMonto(abierto);
    const total = abierto.montoTotal;
    const acumulado = saved(abierto);
    const restante = Math.max(total - acumulado, 0);
    const porcentaje = pct(abierto);
    const done = estado === 'definido' && acumulado >= total;

    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between">
          <button type="button" className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }} onClick={() => setOpenId(null)}>← Volver</button>
          <button type="button" className="text-[12.5px] font-semibold underline" style={{ color: COLORS.inkSoft }} onClick={() => borrarObjetivo(abierto.id)}>Borrar</button>
        </div>

        <div className={`bg-white rounded-2xl p-4 flex gap-4 items-center ${CARD_SHADOW}`}>
          {estado === 'definido' && (
            <Donut
              segments={[{ color: done ? COLORS.green : COLORS.gold, pct: porcentaje }]}
              centerLabel={done ? '¡Lograste!' : 'Logrado'}
              centerValue={`${porcentaje}%`}
              size={96}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-bold truncate" style={{ color: COLORS.ink }}>{abierto.nombre}</p>
              {abierto.tipo === 'grupal' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                  👥 Grupal
                </span>
              )}
              {estado === 'incompleto' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.coralSoft, color: COLORS.coralDark }}>
                  Incompleto
                </span>
              )}
              {estado === 'desconocido' && (
                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
                  Por definir
                </span>
              )}
            </div>
            {abierto.descripcion && <p className="text-[12.5px] mt-0.5" style={{ color: COLORS.inkSoft }}>{abierto.descripcion}</p>}
            {estado === 'definido' && (
              <>
                <p className="text-[13px] mt-1.5" style={{ color: COLORS.ink }}>
                  Llevás <strong>{fmtMoney(acumulado)}</strong> de {montoLabel(abierto)}
                </p>
                {!done && <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Te falta {fmtMoney(restante)}</p>}
              </>
            )}
            {estado === 'incompleto' && (
              <p className="text-[12.5px] mt-1 font-medium" style={{ color: COLORS.coralDark }}>Falta ponerle un monto — completalo para ver el progreso.</p>
            )}
            {estado === 'desconocido' && (
              <p className="text-[12.5px] mt-1" style={{ color: COLORS.inkSoft }}>Todavía no definiste cuánto necesitás.</p>
            )}
          </div>
        </div>

        {estado !== 'definido' && (
          <div className={`bg-white rounded-2xl p-4 flex flex-col gap-2.5 ${CARD_SHADOW}`}>
            <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
            <MontoPicker
              modo={montoModoEdit} setModo={setMontoModoEdit}
              montoTxt={montoTotalEdit} setMontoTxt={setMontoTotalEdit}
              minTxt={montoMinEdit} setMinTxt={setMontoMinEdit}
            />
            <button
              type="button"
              onClick={completarMontoTotal}
              disabled={montoModoEdit !== 'desconocido' && parseMoneyInput(montoTotalEdit) <= 0}
              className="rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand }}
            >
              Guardar
            </button>
          </div>
        )}

        {done && (
          <div className="rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-center" style={{ background: COLORS.greenSoft, color: COLORS.ink }}>
            🎉 ¡Ya juntaste todo lo que necesitás para este objetivo!
          </div>
        )}

        {/* Registrar un pago o un ahorro */}
        <div className={`bg-white rounded-2xl p-4 flex flex-col gap-2.5 ${CARD_SHADOW}`}>
          <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>Sumar un registro</p>
          <div className="grid grid-cols-2 gap-2">
            {(['paid', 'saved'] as const).map((k) => {
              const sel = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="py-2 rounded-xl text-[13px] font-semibold transition-all duration-100 active:scale-95"
                  style={sel ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
                >
                  {k === 'paid' ? 'Ya lo pagué' : 'Lo separé'}
                </button>
              );
            })}
          </div>
          <input
            className={inputClass}
            placeholder={kind === 'paid' ? '¿Qué pagaste? (opcional)' : 'Nota (opcional)'}
            value={regLabel}
            onChange={(e) => setRegLabel(e.target.value)}
          />
          {abierto.tipo === 'grupal' && grupo && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[12px] font-semibold" style={{ color: COLORS.inkSoft }}>¿Quién lo hizo?</p>
              <div className="flex flex-wrap gap-2">
                {[miNombre, ...grupo.miembros.filter((m) => m.nombre !== miNombre).map((m) => m.nombre)].map((n) => (
                  <Chip key={n} on={(regDe || miNombre) === n} onClick={() => setRegDe(n)}>{n}</Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={`flex-1 ${inputClass}`}
              placeholder="Monto"
              inputMode="numeric"
              value={regMonto}
              onChange={(e) => setRegMonto(formatThousands(e.target.value))}
            />
            <button
              type="button"
              onClick={agregarRegistro}
              disabled={parseMoneyInput(regMonto) <= 0}
              className="rounded-xl px-4 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand }}
            >
              +
            </button>
          </div>
        </div>

        {/* Historial de registros */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Registros</p>
          {abierto.contribuciones.length === 0 && <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste nada.</p>}
          {abierto.contribuciones.map((c) => (
            <div key={c.id} className={`flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 ${CARD_SHADOW}`}>
              <span
                className="text-[10.5px] font-bold rounded-full px-2 py-0.5 shrink-0"
                style={{ background: c.kind === 'paid' ? COLORS.greenSoft : COLORS.goldSoft, color: COLORS.ink }}
              >
                {c.kind === 'paid' ? 'Pagado' : 'Separado'}
              </span>
              <span className="flex-1 min-w-0 truncate">
                <span className="text-[13.5px]" style={{ color: COLORS.ink }}>{c.label}</span>
                {abierto.tipo === 'grupal' && <span className="text-[12px]" style={{ color: COLORS.inkSoft }}> · {c.de}</span>}
              </span>
              <span className="text-[12px] shrink-0" style={{ color: COLORS.inkSoft }}>{c.fecha}</span>
              <span className="font-semibold text-[13.5px] shrink-0" style={{ color: COLORS.ink }}>{fmtMoney(c.monto)}</span>
              <button type="button" onClick={() => borrarRegistro(c.id)} className="shrink-0" style={{ color: COLORS.inkFaint }} aria-label="Borrar registro">✕</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Vista: crear objetivo ──
  if (creating) {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-3.5">
        <button type="button" className="text-[13px] font-semibold self-start" style={{ color: COLORS.inkSoft }} onClick={() => setCreating(false)}>← Volver</button>
        <h1 className="text-[21px] font-bold" style={{ color: COLORS.ink }}>Nombre del objetivo</h1>
        <input className={`${inputClass} rounded-2xl py-3 text-[15px]`} placeholder="Ej: Viaje a Bariloche" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className={`${inputClass} rounded-2xl py-3 text-[15px]`} placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

        {grupo && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] font-bold" style={{ color: COLORS.ink }}>¿Individual o grupal?</p>
            <SegmentedTab
              options={[
                { id: 'individual', label: 'Individual' },
                { id: 'grupal', label: `Grupal (${grupo.nombre})` },
              ]}
              value={tipo}
              onChange={setTipo}
              trackColor={COLORS.gold}
            />
          </div>
        )}

        <p className="text-[13px] font-bold -mb-1" style={{ color: COLORS.ink }}>¿Cuánto necesitás?</p>
        <MontoPicker
          modo={montoModo} setModo={setMontoModo}
          montoTxt={montoTotal} setMontoTxt={setMontoTotal}
          minTxt={montoMinTxt} setMinTxt={setMontoMinTxt}
        />
        <Cta label="Agregar objetivo" disabled={!nombre.trim()} onClick={crearObjetivo} />
      </div>
    );
  }

  // ── Vista: lista ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Objetivos</h1>
      <Coachmark id="objetivos">Acá armás lo que querés lograr — solo o con tu grupo de amigas — y vas anotando lo que pagás o separás para cada uno.</Coachmark>
      {objetivos.length === 0 && <p className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>Todavía no armaste ningún objetivo.</p>}
      {objetivos.map((o) => {
        const estado = estadoMonto(o);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpenId(o.id)}
            className={`w-full flex items-center gap-3.5 text-left bg-white rounded-2xl p-4 ${CARD_SHADOW}`}
          >
            {estado === 'definido' ? (
              <Donut
                segments={[{ color: pct(o) >= 100 ? COLORS.green : COLORS.gold, pct: pct(o) }]}
                centerLabel=""
                centerValue={`${pct(o)}%`}
                size={56}
              />
            ) : estado === 'desconocido' ? (
              <span className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[10px] text-center font-bold shrink-0 px-1 leading-tight" style={{ borderColor: COLORS.gold, color: COLORS.gold }}>
                por<br />definir
              </span>
            ) : (
              <span className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center text-[10px] text-center font-bold shrink-0 px-1 leading-tight" style={{ borderColor: COLORS.coral, color: COLORS.coral }}>
                falta<br />monto
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[15px] truncate" style={{ color: COLORS.ink }}>{o.nombre}</p>
                {o.tipo === 'grupal' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.brandSoft, color: COLORS.brandDark }}>
                    👥
                  </span>
                )}
                {estado === 'incompleto' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.coralSoft, color: COLORS.coralDark }}>
                    Incompleto
                  </span>
                )}
                {estado === 'desconocido' && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
                    Por definir
                  </span>
                )}
              </div>
              {estado === 'definido' && <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Llevás {fmtMoney(saved(o))} de {montoLabel(o)}</p>}
              {estado === 'incompleto' && <p className="text-[12.5px] font-medium" style={{ color: COLORS.coralDark }}>Falta completar el monto</p>}
              {estado === 'desconocido' && <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Todavía no definiste cuánto necesitás</p>}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full rounded-2xl border border-dashed py-4 text-[15px] font-bold transition-all duration-100 active:scale-[0.99]"
        style={{ borderColor: 'rgba(31,27,46,0.25)', color: COLORS.ink }}
      >
        + Agregar objetivo
      </button>
    </div>
  );
}

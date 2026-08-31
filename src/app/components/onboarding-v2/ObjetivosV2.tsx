import { useState } from 'react';
import { Cta, Donut, COLORS, fmtMoney, formatThousands, parseMoneyInput, loadV2ObjetivosIniciales } from './shared';

// REDISEÑO v2 — Objetivos: mantiene la lógica "oficial" de la app real
// (ver ObjetivosPage.tsx / GoalEditModal.tsx) pasada a la estética nueva —
// un objetivo tiene un monto total y una lista de REGISTROS ("ya lo pagué"
// / "lo separé") que van llenando el donut. Lo que falta = pendiente.
//
// Si en el onboarding dijo que ya tenía objetivos en mente y los nombró,
// ya aparecen acá creados (sin monto) — se completa el resto en el momento.

type Kind = 'paid' | 'saved';
type Contribucion = { id: string; monto: number; kind: Kind; label: string; fecha: string };
type Objetivo = { id: string; nombre: string; descripcion: string; montoTotal: number; contribuciones: Contribucion[] };

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
    montoTotal: 0,
    contribuciones: [],
  }));
}

export function ObjetivosV2() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>(objetivosIniciales);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montoTotal, setMontoTotal] = useState('');

  const [kind, setKind] = useState<Kind>('paid');
  const [regLabel, setRegLabel] = useState('');
  const [regMonto, setRegMonto] = useState('');
  const [montoTotalEdit, setMontoTotalEdit] = useState('');

  const abierto = objetivos.find((o) => o.id === openId) || null;

  function crearObjetivo() {
    if (!nombre.trim()) return;
    const id = String(Date.now());
    setObjetivos((os) => [...os, { id, nombre: nombre.trim(), descripcion: descripcion.trim(), montoTotal: parseMoneyInput(montoTotal), contribuciones: [] }]);
    setNombre(''); setDescripcion(''); setMontoTotal('');
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
    };
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: [nuevo, ...o.contribuciones] } : o)));
    setRegLabel(''); setRegMonto('');
  }

  function borrarRegistro(regId: string) {
    if (!abierto) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, contribuciones: o.contribuciones.filter((c) => c.id !== regId) } : o)));
  }

  function completarMontoTotal() {
    if (!abierto) return;
    const monto = parseMoneyInput(montoTotalEdit);
    if (monto <= 0) return;
    setObjetivos((os) => os.map((o) => (o.id === abierto.id ? { ...o, montoTotal: monto } : o)));
    setMontoTotalEdit('');
  }

  const saved = (o: Objetivo) => o.contribuciones.reduce((s, c) => s + c.monto, 0);
  const pct = (o: Objetivo) => (o.montoTotal > 0 ? Math.min(Math.round((saved(o) / o.montoTotal) * 100), 100) : 0);

  // ── Vista: detalle de un objetivo ──
  if (abierto) {
    const total = abierto.montoTotal;
    const acumulado = saved(abierto);
    const restante = Math.max(total - acumulado, 0);
    const porcentaje = pct(abierto);
    const done = total > 0 && acumulado >= total;

    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
        <div className="flex items-center justify-between">
          <button type="button" className="text-[13px] font-semibold" style={{ color: COLORS.inkSoft }} onClick={() => setOpenId(null)}>← Volver</button>
          <button type="button" className="text-[12.5px] font-semibold underline" style={{ color: COLORS.inkSoft }} onClick={() => borrarObjetivo(abierto.id)}>Borrar</button>
        </div>

        <div className={`bg-white rounded-2xl p-4 flex gap-4 items-center ${CARD_SHADOW}`}>
          {total > 0 && (
            <Donut
              segments={[{ color: done ? COLORS.green : COLORS.gold, pct: porcentaje }]}
              centerLabel={done ? '¡Lograste!' : 'Logrado'}
              centerValue={`${porcentaje}%`}
              size={96}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold truncate" style={{ color: COLORS.ink }}>{abierto.nombre}</p>
            {abierto.descripcion && <p className="text-[12.5px] mt-0.5" style={{ color: COLORS.inkSoft }}>{abierto.descripcion}</p>}
            {total > 0 ? (
              <>
                <p className="text-[13px] mt-1.5" style={{ color: COLORS.ink }}>
                  Llevás <strong>{fmtMoney(acumulado)}</strong> de {fmtMoney(total)}
                </p>
                {!done && <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Te falta {fmtMoney(restante)}</p>}
              </>
            ) : (
              <p className="text-[12.5px] mt-1" style={{ color: COLORS.inkSoft }}>Todavía no le pusiste un monto — completalo para ver el progreso.</p>
            )}
          </div>
        </div>

        {total === 0 && (
          <div className={`bg-white rounded-2xl p-4 flex gap-2 ${CARD_SHADOW}`}>
            <div className="relative flex-1">
              <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
              <input
                className={`w-full ${inputClass} pl-8`}
                placeholder="¿Cuánto necesitás en total?"
                inputMode="numeric"
                value={montoTotalEdit}
                onChange={(e) => setMontoTotalEdit(formatThousands(e.target.value))}
              />
            </div>
            <button
              type="button"
              onClick={completarMontoTotal}
              disabled={parseMoneyInput(montoTotalEdit) <= 0}
              className="rounded-xl px-4 font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
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
              <span className="flex-1 text-[13.5px] truncate" style={{ color: COLORS.ink }}>{c.label}</span>
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
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>$</span>
          <input
            className={`w-full ${inputClass} rounded-2xl py-3 pl-8 text-[15px]`}
            placeholder="Monto total"
            inputMode="numeric"
            value={montoTotal}
            onChange={(e) => setMontoTotal(formatThousands(e.target.value))}
          />
        </div>
        <Cta label="Agregar objetivo" disabled={!nombre.trim()} onClick={crearObjetivo} />
      </div>
    );
  }

  // ── Vista: lista ──
  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Objetivos</h1>
      {objetivos.length === 0 && <p className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>Todavía no armaste ningún objetivo.</p>}
      {objetivos.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setOpenId(o.id)}
          className={`w-full flex items-center gap-3.5 text-left bg-white rounded-2xl p-4 ${CARD_SHADOW}`}
        >
          {o.montoTotal > 0 ? (
            <Donut
              segments={[{ color: pct(o) >= 100 ? COLORS.green : COLORS.gold, pct: pct(o) }]}
              centerLabel=""
              centerValue={`${pct(o)}%`}
              size={56}
            />
          ) : (
            <span className="w-14 h-14 rounded-full border border-dashed flex items-center justify-center text-[11px] text-center font-semibold shrink-0 px-1" style={{ borderColor: 'rgba(31,27,46,0.25)', color: COLORS.inkSoft }}>
              sin monto
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] truncate" style={{ color: COLORS.ink }}>{o.nombre}</p>
            {o.montoTotal > 0 ? (
              <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Llevás {fmtMoney(saved(o))} de {fmtMoney(o.montoTotal)}</p>
            ) : (
              <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Tocá para completar el monto</p>
            )}
          </div>
        </button>
      ))}
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

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
          <button type="button" className="text-[13px] font-semibold text-[#5b5b52]" onClick={() => setOpenId(null)}>← Volver</button>
          <button type="button" className="text-[12.5px] font-semibold text-[#5b5b52] underline" onClick={() => borrarObjetivo(abierto.id)}>Borrar</button>
        </div>

        <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E] flex gap-4 items-center">
          {total > 0 && (
            <Donut
              segments={[{ color: done ? COLORS.mint : COLORS.yellow, pct: porcentaje }]}
              centerLabel={done ? '¡Lograste!' : 'Logrado'}
              centerValue={`${porcentaje}%`}
              size={96}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-['Baloo_2'] text-[18px] font-bold text-[#1E1E1E] truncate">{abierto.nombre}</p>
            {abierto.descripcion && <p className="text-[12.5px] text-[#5b5b52] mt-0.5">{abierto.descripcion}</p>}
            {total > 0 ? (
              <>
                <p className="text-[13px] mt-1.5">
                  Llevás <strong>{fmtMoney(acumulado)}</strong> de {fmtMoney(total)}
                </p>
                {!done && <p className="text-[12px] text-[#5b5b52]">Te falta {fmtMoney(restante)}</p>}
              </>
            ) : (
              <p className="text-[12.5px] text-[#5b5b52] mt-1">Todavía no le pusiste un monto — completalo para ver el progreso.</p>
            )}
          </div>
        </div>

        {total === 0 && (
          <div className="bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-4 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute top-1/2 -translate-y-1/2 left-4 text-[#5b5b52]">$</span>
              <input
                className="w-full border-[1.5px] border-[#1E1E1E] rounded-xl pl-8 pr-3 py-2.5 text-[14px] outline-none"
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
              className="rounded-xl border-2 border-[#1E1E1E] px-4 font-bold disabled:opacity-40"
              style={{ background: COLORS.mint }}
            >
              Guardar
            </button>
          </div>
        )}

        {done && (
          <div className="rounded-2xl border-[2.5px] border-[#1E1E1E] px-4 py-3 text-[13.5px] font-semibold text-center" style={{ background: COLORS.mintLight }}>
            🎉 ¡Ya juntaste todo lo que necesitás para este objetivo!
          </div>
        )}

        {/* Registrar un pago o un ahorro */}
        <div className="bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-2.5">
          <p className="text-[13px] font-bold text-[#1E1E1E]">Sumar un registro</p>
          <div className="grid grid-cols-2 gap-2">
            {(['paid', 'saved'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="py-2 rounded-xl border-2 border-[#1E1E1E] text-[13px] font-semibold"
                style={{ background: kind === k ? COLORS.mint : '#fff' }}
              >
                {k === 'paid' ? 'Ya lo pagué' : 'Lo separé'}
              </button>
            ))}
          </div>
          <input
            className="border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13.5px] outline-none"
            placeholder={kind === 'paid' ? '¿Qué pagaste? (opcional)' : 'Nota (opcional)'}
            value={regLabel}
            onChange={(e) => setRegLabel(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13.5px] outline-none"
              placeholder="Monto"
              inputMode="numeric"
              value={regMonto}
              onChange={(e) => setRegMonto(formatThousands(e.target.value))}
            />
            <button
              type="button"
              onClick={agregarRegistro}
              disabled={parseMoneyInput(regMonto) <= 0}
              className="rounded-xl border-[2px] border-[#1E1E1E] px-4 font-bold disabled:opacity-40"
              style={{ background: COLORS.yellow }}
            >
              +
            </button>
          </div>
        </div>

        {/* Historial de registros */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#5b5b52]">Registros</p>
          {abierto.contribuciones.length === 0 && <p className="text-[13px] text-[#5b5b52]">Todavía no registraste nada.</p>}
          {abierto.contribuciones.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 bg-white border-[2px] border-[#1E1E1E] rounded-xl px-3.5 py-2.5">
              <span
                className="text-[10.5px] font-bold rounded-full px-2 py-0.5 border-2 border-[#1E1E1E] shrink-0"
                style={{ background: c.kind === 'paid' ? COLORS.mint : COLORS.yellowSoft }}
              >
                {c.kind === 'paid' ? 'Pagado' : 'Separado'}
              </span>
              <span className="flex-1 text-[13.5px] text-[#1E1E1E] truncate">{c.label}</span>
              <span className="text-[12px] text-[#5b5b52] shrink-0">{c.fecha}</span>
              <span className="font-semibold text-[13.5px] text-[#1E1E1E] shrink-0">{fmtMoney(c.monto)}</span>
              <button type="button" onClick={() => borrarRegistro(c.id)} className="text-[#5b5b52] shrink-0" aria-label="Borrar registro">✕</button>
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
        <button type="button" className="text-[13px] font-semibold text-[#5b5b52] self-start" onClick={() => setCreating(false)}>← Volver</button>
        <h1 className="font-['Baloo_2'] text-[21px] font-bold text-[#1E1E1E]">Nombre del objetivo</h1>
        <input className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] outline-none" placeholder="Ej: Viaje a Bariloche" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] outline-none" placeholder="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 left-4 text-[#5b5b52]">$</span>
          <input
            className="w-full border-[2.5px] border-[#1E1E1E] rounded-2xl pl-8 pr-4 py-3 text-[15px] outline-none"
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
      <h1 className="font-['Baloo_2'] text-[22px] font-bold text-[#1E1E1E]">Objetivos</h1>
      {objetivos.length === 0 && <p className="text-[13.5px] text-[#5b5b52]">Todavía no armaste ningún objetivo.</p>}
      {objetivos.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setOpenId(o.id)}
          className="w-full flex items-center gap-3.5 text-left bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E]"
        >
          {o.montoTotal > 0 ? (
            <Donut
              segments={[{ color: pct(o) >= 100 ? COLORS.mint : COLORS.yellow, pct: pct(o) }]}
              centerLabel=""
              centerValue={`${pct(o)}%`}
              size={56}
            />
          ) : (
            <span className="w-14 h-14 rounded-full border-[2.5px] border-dashed border-[#1E1E1E] flex items-center justify-center text-[11px] text-center font-semibold text-[#5b5b52] shrink-0 px-1">
              sin monto
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] text-[#1E1E1E] truncate">{o.nombre}</p>
            {o.montoTotal > 0 ? (
              <p className="text-[12.5px] text-[#5b5b52]">Llevás {fmtMoney(saved(o))} de {fmtMoney(o.montoTotal)}</p>
            ) : (
              <p className="text-[12.5px] text-[#5b5b52]">Tocá para completar el monto</p>
            )}
          </div>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="w-full rounded-2xl border-[2.5px] border-dashed border-[#1E1E1E] py-4 text-[15px] font-bold"
      >
        + Agregar objetivo
      </button>
    </div>
  );
}

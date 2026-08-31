import { useState } from 'react';
import { Cta, COLORS } from './shared';

// REDISEÑO v2 — Objetivos: "como lo tenemos" (pediste no rediseñar la lógica,
// solo pasarla a la estética nueva). Lista con "+ Agregar objetivo", detalle
// con nombre/descripción/monto total, ítems (con Pagado/Pendiente) y
// "reservar $". El "+" flotante agrega un gasto suelto al objetivo abierto.

type Item = { id: string; nombre: string; monto: string; pagado: boolean };
type Objetivo = { id: string; nombre: string; descripcion: string; montoTotal: string; items: Item[] };

export function ObjetivosV2() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [nuevoItem, setNuevoItem] = useState('');

  const abierto = objetivos.find((o) => o.id === openId) || null;

  function crearObjetivo() {
    if (!nombre.trim()) return;
    const id = String(Date.now());
    setObjetivos((os) => [...os, { id, nombre, descripcion, montoTotal, items: [] }]);
    setNombre(''); setDescripcion(''); setMontoTotal('');
    setCreating(false);
    setOpenId(id);
  }

  function agregarItem() {
    if (!abierto || !nuevoItem.trim()) return;
    setObjetivos((os) => os.map((o) => o.id === abierto.id
      ? { ...o, items: [...o.items, { id: String(Date.now()), nombre: nuevoItem, monto: '', pagado: false }] }
      : o));
    setNuevoItem('');
  }

  function toggleItem(itemId: string) {
    if (!abierto) return;
    setObjetivos((os) => os.map((o) => o.id === abierto.id
      ? { ...o, items: o.items.map((it) => it.id === itemId ? { ...it, pagado: !it.pagado } : it) }
      : o));
  }

  // ── Vista: detalle de un objetivo ──
  if (abierto) {
    return (
      <div className="px-[22px] pt-8 flex flex-col gap-4 relative min-h-[70vh]">
        <button type="button" className="text-[13px] font-semibold text-[#5b5b52] self-start" onClick={() => setOpenId(null)}>← Volver</button>

        <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E]">
          <p className="font-['Baloo_2'] text-[19px] font-bold text-[#1E1E1E]">{abierto.nombre}</p>
          {abierto.descripcion && <p className="text-[13px] text-[#5b5b52] mt-1">{abierto.descripcion}</p>}
          {abierto.montoTotal && <p className="text-[14px] font-semibold mt-2">Monto total: ${abierto.montoTotal}</p>}
        </div>

        <button
          type="button"
          className="w-full rounded-xl border-[2px] border-dashed border-[#1E1E1E] py-3 text-[13.5px] font-semibold"
          style={{ background: COLORS.yellowSoft }}
        >
          💰 Reservar $
        </button>

        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#5b5b52]">Ítems</p>
          {abierto.items.length === 0 && <p className="text-[13px] text-[#5b5b52]">Todavía no agregaste ítems.</p>}
          {abierto.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between bg-white border-[2px] border-[#1E1E1E] rounded-xl px-3.5 py-2.5">
              <span className="text-[14px] text-[#1E1E1E]">{it.nombre}</span>
              <button
                type="button"
                onClick={() => toggleItem(it.id)}
                className="text-[11px] font-bold rounded-full px-2.5 py-1 border-2 border-[#1E1E1E]"
                style={{ background: it.pagado ? COLORS.mint : COLORS.coralSoft }}
              >
                {it.pagado ? 'Pagado' : 'Pendiente'}
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13px] outline-none"
              placeholder="Agregar ítem (tipo, sección)"
              value={nuevoItem}
              onChange={(e) => setNuevoItem(e.target.value)}
            />
            <button type="button" className="rounded-xl border-[2px] border-[#1E1E1E] px-3.5 font-bold" style={{ background: COLORS.yellow }} onClick={agregarItem}>+</button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Agregar gasto"
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full border-[2.5px] border-[#1E1E1E] flex items-center justify-center text-2xl font-bold shadow-[4px_4px_0_#1E1E1E]"
          style={{ background: COLORS.mint }}
        >
          +
        </button>
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
        <input className="border-[2.5px] border-[#1E1E1E] rounded-2xl px-4 py-3 text-[15px] outline-none" placeholder="Monto total" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} />
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
          className="w-full text-left bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E]"
        >
          <p className="font-semibold text-[15px] text-[#1E1E1E]">{o.nombre}</p>
          {o.montoTotal && <p className="text-[12.5px] text-[#5b5b52]">Meta: ${o.montoTotal}</p>}
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

import { useState } from 'react';
import { COLORS } from './shared';

// REDISEÑO v2 — Mis Gastos: "sobres" por categoría (la idea de cash stuffing
// digital que charlamos), cada uno se expande para ver el detalle y editar
// el tope. Sin categoría con datos todavía → estado "aprendiendo" honesto,
// en vez de un tope inventado.

type Sobre = {
  id: string;
  name: string;
  amountTxt: string;
  hasTope: boolean;
  tope?: string;
  barPct?: number;
  barColor?: string;
  movs: { d: string; a: string }[];
};

const DATA: Sobre[] = [
  { id: 'delivery', name: 'Delivery', amountTxt: '$14.200 esta semana', hasTope: true, tope: '$15.000/sem', barPct: 88, barColor: COLORS.mint,
    movs: [{ d: 'PedidosYa · ayer', a: '$4.100' }, { d: 'Rappi · lunes', a: '$3.600' }] },
  { id: 'ropa', name: 'Ropa', amountTxt: '$8.900 este mes', hasTope: true, tope: '$20.000/mes', barPct: 44, barColor: COLORS.coral,
    movs: [{ d: 'Zara · 4 ago', a: '$8.900' }] },
  { id: 'transporte', name: 'Transporte', amountTxt: '$5.100 esta semana', hasTope: true, tope: '$6.000/sem', barPct: 85, barColor: COLORS.mint,
    movs: [{ d: 'SUBE · hoy', a: '$1.200' }] },
  { id: 'super', name: 'Supermercado', amountTxt: 'Sin registros todavía', hasTope: false, movs: [] },
];

export function GastosV2() {
  const [openId, setOpenId] = useState<string | null>('delivery');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4">
      <div>
        <h1 className="font-['Baloo_2'] text-[22px] font-bold text-[#1E1E1E]">Mis Gastos</h1>
        <p className="text-[13.5px] text-[#5b5b52]">Lo que fuiste contando por WhatsApp.</p>
      </div>

      {DATA.map((s) => {
        const open = openId === s.id;
        const tope = overrides[s.id] || s.tope;
        return (
          <div key={s.id} className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E]">
            <button type="button" className="w-full flex items-center justify-between" onClick={() => setOpenId(open ? null : s.id)}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center" style={{ background: COLORS.yellowSoft }}>
                  🧾
                </span>
                <div className="text-left">
                  <p className="font-semibold text-[14.5px] text-[#1E1E1E]">{s.name}</p>
                  <p className="text-[12.5px] text-[#5b5b52]">{s.amountTxt}</p>
                </div>
              </div>
              <span className="text-[#5b5b52]">{open ? '▲' : '▼'}</span>
            </button>

            {s.hasTope && (
              <div className="mt-3">
                <div className="h-2 bg-[#f0ead6] rounded-full overflow-hidden border border-[#1E1E1E]/20">
                  <div className="h-full rounded-full" style={{ width: `${s.barPct}%`, background: s.barColor }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[12px]">
                  <span className="text-[#5b5b52]">Tope: {tope}</span>
                  <button type="button" className="font-semibold underline" onClick={() => setOpenId(s.id)}>Editar</button>
                </div>
              </div>
            )}
            {!s.hasTope && (
              <div className="mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: COLORS.yellowSoft }}>
                👀 Por ahora, estamos mirando cómo es tu semana acá
              </div>
            )}

            {open && (
              <div className="mt-3 pt-3 border-t-2 border-dashed border-[#1E1E1E]/20 flex flex-col gap-2">
                {s.movs.map((m, i) => (
                  <div key={i} className="flex justify-between text-[13px] text-[#1E1E1E]">
                    <span>{m.d}</span>
                    <span className="text-[#5b5b52]">{m.a}</span>
                  </div>
                ))}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13px] outline-none"
                    placeholder="Definí tu tope"
                    value={edits[s.id] || ''}
                    onChange={(e) => setEdits((v) => ({ ...v, [s.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded-xl border-[2px] border-[#1E1E1E] px-3.5 py-2 text-[12.5px] font-bold"
                    style={{ background: COLORS.mint }}
                    onClick={() => {
                      const val = (edits[s.id] || '').trim();
                      if (!val) return;
                      setOverrides((v) => ({ ...v, [s.id]: val }));
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

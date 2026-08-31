import { useState } from 'react';
import { Cta, Donut, COLORS, fmtMoney, formatThousands, parseMoneyInput, slug, loadV2Categorias } from './shared';

// REDISEÑO v2 — Mis Gastos. Estructura del boceto: dinero disponible +
// gastos con sus botones de "agregar", visualización arriba (donut +
// distribución por tipo), sobres por categoría con tope editable, gastos
// recientes, y una reserva tipo ahorro (mismo concepto que ReserveControl.tsx
// de la app real, pasado a esta estética).
//
// Las categorías que la persona marcó en el onboarding ("¿en qué se te
// suele ir la plata?") ya aparecen acá como secciones — ver shared.tsx.

type TipoGasto = 'urgente' | 'impulsivo' | 'necesario' | 'otro';
type Categoria = { id: string; nombre: string };
type Gasto = { id: string; monto: number; descripcion: string; categoriaId: string; tipo: TipoGasto; fecha: string };

const TIPO_INFO: Record<TipoGasto, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: COLORS.coral },
  impulsivo: { label: 'Impulsivo', color: COLORS.yellow },
  necesario: { label: 'Necesario', color: COLORS.mint },
  otro: { label: 'Otro', color: COLORS.sky },
};
const TIPOS: TipoGasto[] = ['necesario', 'urgente', 'impulsivo', 'otro'];

const CAT_COLORS = [COLORS.mint, COLORS.coral, COLORS.yellow, COLORS.sky, '#C9A6F5', '#FFB067'];
const DEFAULT_CATEGORIAS: Categoria[] = [
  { id: 'delivery', nombre: 'Delivery' },
  { id: 'ropa', nombre: 'Ropa' },
  { id: 'transporte', nombre: 'Transporte' },
  { id: 'super', nombre: 'Supermercado' },
];

function categoriasIniciales(): Categoria[] {
  const guardadas = loadV2Categorias();
  if (guardadas.length === 0) return DEFAULT_CATEGORIAS;
  return guardadas.map((nombre) => ({ id: slug(nombre), nombre }));
}

function seedGastos(categorias: Categoria[]): Gasto[] {
  if (categorias.length === 0) return [];
  const pick = (i: number) => categorias[i % categorias.length];
  return [
    { id: 's1', monto: 4100, descripcion: 'PedidosYa', categoriaId: pick(0).id, tipo: 'impulsivo', fecha: 'Ayer' },
    { id: 's2', monto: 3600, descripcion: 'Rappi', categoriaId: pick(0).id, tipo: 'impulsivo', fecha: 'Lunes' },
    { id: 's3', monto: 8900, descripcion: 'Zara', categoriaId: pick(1).id, tipo: 'otro', fecha: '4 ago' },
    { id: 's4', monto: 1200, descripcion: 'SUBE', categoriaId: pick(2).id, tipo: 'necesario', fecha: 'Hoy' },
    { id: 's5', monto: 6200, descripcion: 'Super de la semana', categoriaId: pick(3).id, tipo: 'necesario', fecha: 'Domingo' },
  ];
}

export function GastosV2() {
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciales);
  const [gastos, setGastos] = useState<Gasto[]>(() => seedGastos(categoriasIniciales()));
  const [disponible, setDisponible] = useState(60000);
  const [reserva, setReserva] = useState(0);

  const [openCatId, setOpenCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [topes, setTopes] = useState<Record<string, string>>({});
  const [topeEdit, setTopeEdit] = useState<Record<string, string>>({});

  const [addingDisponible, setAddingDisponible] = useState(false);
  const [addDispVal, setAddDispVal] = useState('');

  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaVal, setReservaVal] = useState('');

  const [addingGasto, setAddingGasto] = useState(false);
  const [ngMonto, setNgMonto] = useState('');
  const [ngDesc, setNgDesc] = useState('');
  const [ngCatId, setNgCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [ngNuevaCat, setNgNuevaCat] = useState('');
  const [ngTipo, setNgTipo] = useState<TipoGasto>('necesario');

  const totalGastado = gastos.reduce((s, g) => s + g.monto, 0);
  const gastadoEn = (catId: string) => gastos.filter((g) => g.categoriaId === catId).reduce((s, g) => s + g.monto, 0);
  const colorDe = (catId: string) => CAT_COLORS[Math.max(categorias.findIndex((c) => c.id === catId), 0) % CAT_COLORS.length];

  const donutCategorias = categorias
    .map((c) => ({ color: colorDe(c.id), pct: totalGastado > 0 ? (gastadoEn(c.id) / totalGastado) * 100 : 0 }))
    .filter((s) => s.pct > 0);

  const porTipo = TIPOS.map((t) => ({
    tipo: t,
    monto: gastos.filter((g) => g.tipo === t).reduce((s, g) => s + g.monto, 0),
  })).filter((t) => t.monto > 0);

  function agregarDinero() {
    const n = parseMoneyInput(addDispVal);
    if (!n) return;
    setDisponible((d) => d + n);
    setAddDispVal('');
    setAddingDisponible(false);
  }

  function crearCategoria(nombre: string): string {
    const id = slug(nombre);
    setCategorias((cs) => (cs.some((c) => c.id === id) ? cs : [...cs, { id, nombre }]));
    return id;
  }

  function agregarGasto() {
    const monto = parseMoneyInput(ngMonto);
    if (monto <= 0) return;
    const catId = ngNuevaCat.trim() ? crearCategoria(ngNuevaCat.trim()) : ngCatId;
    if (!catId) return;
    setGastos((gs) => [
      { id: String(Date.now()), monto, descripcion: ngDesc.trim() || TIPO_INFO[ngTipo].label, categoriaId: catId, tipo: ngTipo, fecha: 'Hoy' },
      ...gs,
    ]);
    setDisponible((d) => Math.max(d - monto, 0));
    setNgMonto(''); setNgDesc(''); setNgNuevaCat(''); setNgTipo('necesario');
    setAddingGasto(false);
    setOpenCatId(catId);
  }

  function guardarTope(catId: string) {
    const val = (topeEdit[catId] || '').trim();
    if (!val) return;
    setTopes((t) => ({ ...t, [catId]: val }));
  }

  function reservar() {
    const n = parseMoneyInput(reservaVal);
    if (!n) return;
    setReserva((r) => r + n);
    setDisponible((d) => Math.max(d - n, 0));
    setReservaVal('');
    setReservaOpen(false);
  }

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
      <div>
        <h1 className="font-['Baloo_2'] text-[22px] font-bold text-[#1E1E1E]">Mis Gastos</h1>
        <p className="text-[13.5px] text-[#5b5b52]">Lo que fuiste contando por WhatsApp.</p>
      </div>

      {/* Resumen: donut + disponible/gastado */}
      <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E] flex gap-4 items-center">
        <Donut segments={donutCategorias} centerLabel="Gastado" centerValue={fmtMoney(totalGastado)} />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <p className="text-[12px] text-[#5b5b52]">Dinero disponible</p>
            <p className="font-['Baloo_2'] font-bold text-[19px] text-[#1E1E1E]">{fmtMoney(disponible)}</p>
          </div>
          {!addingDisponible ? (
            <button type="button" onClick={() => setAddingDisponible(true)} className="self-start text-[12.5px] font-semibold underline text-[#5b5b52]">
              + Agregar dinero disponible
            </button>
          ) : (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                className="flex-1 min-w-0 border-[1.5px] border-[#1E1E1E] rounded-xl px-2.5 py-1.5 text-[12.5px] outline-none"
                placeholder="Monto"
                inputMode="numeric"
                value={addDispVal}
                onChange={(e) => setAddDispVal(formatThousands(e.target.value))}
              />
              <button type="button" onClick={agregarDinero} className="rounded-xl border-[2px] border-[#1E1E1E] px-2.5 text-[12px] font-bold shrink-0" style={{ background: COLORS.mint }}>
                Ok
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Distribución por tipo — la parte que agrega valor: cuánto es impulso vs necesidad */}
      {porTipo.length > 0 && (
        <div className="bg-white border-[2px] border-[#1E1E1E] rounded-2xl p-3.5 flex flex-col gap-2">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#5b5b52]">¿En qué tipo de gasto se te va?</p>
          <div className="h-2.5 rounded-full overflow-hidden border border-[#1E1E1E]/20 flex">
            {porTipo.map((t) => (
              <div key={t.tipo} style={{ width: `${(t.monto / totalGastado) * 100}%`, background: TIPO_INFO[t.tipo].color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {porTipo.map((t) => (
              <span key={t.tipo} className="flex items-center gap-1.5 text-[11.5px] text-[#5b5b52]">
                <span className="w-2.5 h-2.5 rounded-full border border-[#1E1E1E]/30" style={{ background: TIPO_INFO[t.tipo].color }} />
                {TIPO_INFO[t.tipo].label} · {fmtMoney(t.monto)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agregar gasto */}
      {!addingGasto ? (
        <Cta label="+ Agregar gasto" onClick={() => setAddingGasto(true)} />
      ) : (
        <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 flex flex-col gap-3">
          <div className="relative">
            <span className="absolute top-1/2 -translate-y-1/2 left-4 text-[#5b5b52]">$</span>
            <input
              autoFocus
              className="w-full border-[1.5px] border-[#1E1E1E] rounded-xl pl-8 pr-3 py-2.5 text-[14.5px] outline-none"
              placeholder="Monto"
              inputMode="numeric"
              value={ngMonto}
              onChange={(e) => setNgMonto(formatThousands(e.target.value))}
            />
          </div>
          <input
            className="border-[1.5px] border-[#1E1E1E] rounded-xl px-3.5 py-2.5 text-[14.5px] outline-none"
            placeholder="Descripción (ej: PedidosYa)"
            value={ngDesc}
            onChange={(e) => setNgDesc(e.target.value)}
          />

          <div>
            <p className="text-[12px] font-bold text-[#5b5b52] mb-1.5">Sección</p>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setNgCatId(c.id); setNgNuevaCat(''); }}
                  className="rounded-xl border-2 border-[#1E1E1E] px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: ngCatId === c.id && !ngNuevaCat ? COLORS.mint : '#fff' }}
                >
                  {c.nombre}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setNgCatId(null); setNgNuevaCat(' '); }}
                className="rounded-xl border-2 border-dashed border-[#1E1E1E] px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: ngNuevaCat ? COLORS.yellowSoft : '#fff' }}
              >
                + Nueva
              </button>
            </div>
            {ngNuevaCat && (
              <input
                autoFocus
                className="mt-2 w-full border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13.5px] outline-none"
                placeholder="Nombre de la sección"
                value={ngNuevaCat.trim()}
                onChange={(e) => setNgNuevaCat(e.target.value || ' ')}
              />
            )}
          </div>

          <div>
            <p className="text-[12px] font-bold text-[#5b5b52] mb-1.5">¿Qué tipo de gasto fue?</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNgTipo(t)}
                  className="rounded-xl border-2 border-[#1E1E1E] px-3 py-1.5 text-[13px] font-semibold"
                  style={{ background: ngTipo === t ? TIPO_INFO[t].color : '#fff' }}
                >
                  {TIPO_INFO[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setAddingGasto(false)} className="flex-1 rounded-xl border-2 border-[#1E1E1E] py-2.5 text-[13.5px] font-semibold">
              Cancelar
            </button>
            <button
              type="button"
              onClick={agregarGasto}
              disabled={parseMoneyInput(ngMonto) <= 0 || (!ngCatId && !ngNuevaCat.trim())}
              className="flex-[2] rounded-xl border-2 border-[#1E1E1E] py-2.5 text-[13.5px] font-bold disabled:opacity-40"
              style={{ background: COLORS.mint }}
            >
              Agregar gasto
            </button>
          </div>
        </div>
      )}

      {/* Sobres por categoría */}
      <div className="flex flex-col gap-3">
        {categorias.map((cat) => {
          const open = openCatId === cat.id;
          const gastado = gastadoEn(cat.id);
          const tope = topes[cat.id];
          const movs = gastos.filter((g) => g.categoriaId === cat.id);
          return (
            <div key={cat.id} className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0_#1E1E1E]">
              <button type="button" className="w-full flex items-center justify-between" onClick={() => setOpenCatId(open ? null : cat.id)}>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full border-2 border-[#1E1E1E] shrink-0" style={{ background: colorDe(cat.id) }} />
                  <div className="text-left">
                    <p className="font-semibold text-[14.5px] text-[#1E1E1E]">{cat.nombre}</p>
                    <p className="text-[12.5px] text-[#5b5b52]">{gastado > 0 ? fmtMoney(gastado) : 'Sin registros todavía'}</p>
                  </div>
                </div>
                <span className="text-[#5b5b52]">{open ? '▲' : '▼'}</span>
              </button>

              {tope ? (
                <div className="mt-3">
                  <div className="h-2 bg-[#f0ead6] rounded-full overflow-hidden border border-[#1E1E1E]/20">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((gastado / (parseMoneyInput(tope) || 1)) * 100, 100)}%`, background: colorDe(cat.id) }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[12px]">
                    <span className="text-[#5b5b52]">Tope: {tope}</span>
                    <button type="button" className="font-semibold underline" onClick={() => setOpenCatId(cat.id)}>Editar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: COLORS.yellowSoft }}>
                  👀 Por ahora, estamos mirando cómo es tu {cat.nombre.toLowerCase()}
                </div>
              )}

              {open && (
                <div className="mt-3 pt-3 border-t-2 border-dashed border-[#1E1E1E]/20 flex flex-col gap-2">
                  {movs.length === 0 && <p className="text-[12.5px] text-[#5b5b52]">Todavía no hay movimientos acá.</p>}
                  {movs.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-[13px] text-[#1E1E1E] gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_INFO[m.tipo].color }} />
                        <span className="truncate">{m.descripcion} · {m.fecha}</span>
                      </span>
                      <span className="text-[#5b5b52] shrink-0">{fmtMoney(m.monto)}</span>
                    </div>
                  ))}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13px] outline-none"
                      placeholder="Definí tu tope (ej: $15.000/sem)"
                      value={topeEdit[cat.id] ?? tope ?? ''}
                      onChange={(e) => setTopeEdit((v) => ({ ...v, [cat.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="rounded-xl border-[2px] border-[#1E1E1E] px-3.5 py-2 text-[12.5px] font-bold"
                      style={{ background: COLORS.mint }}
                      onClick={() => guardarTope(cat.id)}
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

      {/* Gastos recientes */}
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[#5b5b52]">Gastos recientes</p>
        {gastos.length === 0 && <p className="text-[13px] text-[#5b5b52]">Todavía no registraste gastos.</p>}
        {gastos.slice(0, 6).map((g) => {
          const cat = categorias.find((c) => c.id === g.categoriaId);
          return (
            <div key={g.id} className="flex items-center gap-2.5 bg-white border-[2px] border-[#1E1E1E] rounded-xl px-3.5 py-2.5">
              <span className="w-2.5 h-2.5 rounded-full border border-[#1E1E1E]/30 shrink-0" style={{ background: TIPO_INFO[g.tipo].color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] text-[#1E1E1E] truncate">{g.descripcion}</p>
                <p className="text-[11.5px] text-[#5b5b52]">{cat?.nombre ?? 'Sin sección'} · {g.fecha}</p>
              </div>
              <span className="font-semibold text-[13.5px] text-[#1E1E1E] shrink-0">{fmtMoney(g.monto)}</span>
            </div>
          );
        })}
      </div>

      {/* Reserva tipo ahorro */}
      <div className="bg-white border-[2.5px] border-[#1E1E1E] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full border-2 border-[#1E1E1E] flex items-center justify-center shrink-0" style={{ background: COLORS.yellowSoft }}>🔒</span>
          <p className="flex-1 text-[14.5px] font-semibold text-[#1E1E1E]">Reserva</p>
          <button type="button" onClick={() => setReservaOpen((o) => !o)} className="text-[13px] font-semibold underline shrink-0">
            {reserva > 0 ? 'Editar' : 'Reservar'}
          </button>
        </div>

        {reserva > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl px-3 py-2.5" style={{ background: COLORS.yellowSoft }}>
              <p className="text-[11px] text-[#5b5b52]">En reserva</p>
              <p className="font-bold text-[15px] text-[#1E1E1E]">{fmtMoney(reserva)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5 bg-[#f5f0dd]">
              <p className="text-[11px] text-[#5b5b52]">Disponible libre</p>
              <p className="font-bold text-[15px] text-[#1E1E1E]">{fmtMoney(disponible)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-[#5b5b52]">Apartá un monto para no gastarlo — tipo alcancía.</p>
        )}

        {reservaOpen && (
          <div className="mt-3 pt-3 border-t-2 border-dashed border-[#1E1E1E]/20 flex gap-2">
            <input
              autoFocus
              className="flex-1 border-[1.5px] border-[#1E1E1E] rounded-xl px-3 py-2 text-[13.5px] outline-none"
              placeholder="¿Cuánto querés reservar?"
              inputMode="numeric"
              value={reservaVal}
              onChange={(e) => setReservaVal(formatThousands(e.target.value))}
            />
            <button type="button" onClick={reservar} className="rounded-xl border-2 border-[#1E1E1E] px-3.5 text-[12.5px] font-bold" style={{ background: COLORS.mint }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

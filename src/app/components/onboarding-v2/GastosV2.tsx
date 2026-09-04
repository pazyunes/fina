import { useEffect, useState } from 'react';
import { Coachmark, Cta, Donut, COLORS, SegmentedTab, fechaDisplay, fmtMoney, formatThousands, parseMoneyInput, slug, loadV2Categorias, loadV2GastosState, saveV2GastosState } from './shared';
import { WHATSAPP_URL } from '../WhatsAppFab';

// REDISEÑO v2 — Mis Gastos. Estructura del boceto: dinero disponible +
// gastos con sus botones de "agregar", visualización arriba (donut +
// distribución por tipo), sobres por categoría con tope editable, buscador
// de gastos, y una reserva tipo ahorro (mismo concepto que
// ReserveControl.tsx de la app real, pasado a esta estética).
//
// Es el extremo "llamativo" del espectro (Gastos grita, Inversiones
// susurra): tarjetas blancas con sombra suave y buen color variado por
// categoría/tipo, pero sin el borde negro grueso ni la sombra de sticker
// de la v1 — eso es lo que se sacó de la mesa.
//
// Las categorías que la persona marcó en el onboarding ("¿en qué se te
// suele ir la plata?") ya aparecen acá como secciones — ver shared.tsx.
//
// Todo esto ahora PERSISTE de verdad (antes vivía solo en el estado de esta
// pantalla y se perdía al navegar a Home y volver) — hace falta para que el
// buscador tenga algo real que buscar, y para que Home pueda resumir tu
// bienestar financiero con datos de verdad.

type TipoGasto = 'urgente' | 'impulsivo' | 'necesario' | 'otro';
type Periodo = 'semana' | 'mes';
type Moneda = 'ARS' | 'USD';
type Tope = { monto: number; periodo: Periodo };
type Categoria = { id: string; nombre: string };
type Gasto = { id: string; monto: number; moneda: Moneda; descripcion: string; categoriaId: string; tipo: TipoGasto; ts: number };
// Nota: el total gastado / disponible siguen calculándose en pesos — un
// gasto en USD se registra y se muestra con su propio signo (US$), pero
// todavía no convertimos a un tipo de cambio real para sumarlo al total.
function fmtGasto(g: { monto: number; moneda: Moneda }): string {
  return g.moneda === 'USD' ? `US$${g.monto.toLocaleString('es-AR')}` : fmtMoney(g.monto);
}
type EstadoGastos = { categorias: Categoria[]; gastos: Gasto[]; disponible: number; reserva: number; topes: Record<string, Tope> };

const TIPO_INFO: Record<TipoGasto, { label: string; color: string }> = {
  urgente: { label: 'Urgente', color: COLORS.coral },
  impulsivo: { label: 'Impulsivo', color: COLORS.gold },
  necesario: { label: 'Necesario', color: COLORS.green },
  otro: { label: 'Otro', color: COLORS.sky },
};
const TIPOS: TipoGasto[] = ['necesario', 'urgente', 'impulsivo', 'otro'];

const CAT_COLORS = [COLORS.brand, COLORS.coral, COLORS.gold, COLORS.sky, COLORS.green, '#C9A6F5'];
// Nota Tailwind: la clase tiene que aparecer COMPLETA en el archivo (aunque
// sea adentro de este string) para que el scanner de Tailwind la detecte —
// por eso no se arma por partes con interpolación.
const CARD_SHADOW = 'shadow-[0_2px_18px_rgba(31,27,46,0.07)]';

// Cuenta nueva: acá solo entra lo que la persona puso en el onboarding — sin
// categorías ni gastos de ejemplo inventados. Si ya había estado antes en
// esta sección, se retoma lo que dejó (persistido); si no, arranca de las
// categorías del onboarding con todo lo demás en cero.
function estadoInicial(): EstadoGastos {
  const persistido = loadV2GastosState<EstadoGastos>();
  if (persistido) return persistido;
  return {
    categorias: loadV2Categorias().map((nombre) => ({ id: slug(nombre), nombre })),
    gastos: [],
    disponible: 0,
    reserva: 0,
    topes: {},
  };
}

export function GastosV2() {
  const [estado, setEstado] = useState<EstadoGastos>(estadoInicial);
  const { categorias, gastos, disponible, reserva, topes } = estado;

  useEffect(() => {
    saveV2GastosState(estado);
  }, [estado]);

  const [openCatId, setOpenCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [topeEditMonto, setTopeEditMonto] = useState<Record<string, string>>({});
  const [topeEditPeriodo, setTopeEditPeriodo] = useState<Record<string, Periodo>>({});

  const [addingDisponible, setAddingDisponible] = useState(false);
  const [addDispVal, setAddDispVal] = useState('');

  const [reservaOpen, setReservaOpen] = useState(false);
  const [reservaVal, setReservaVal] = useState('');

  const [addingGasto, setAddingGasto] = useState(false);
  const [ngMonto, setNgMonto] = useState('');
  const [ngMoneda, setNgMoneda] = useState<Moneda>('ARS');
  const [ngDesc, setNgDesc] = useState('');
  const [ngCatId, setNgCatId] = useState<string | null>(categorias[0]?.id ?? null);
  const [ngNuevaCat, setNgNuevaCat] = useState('');
  const [ngTipo, setNgTipo] = useState<TipoGasto>('necesario');

  // Buscador — por nombre, sección, tipo, y orden por monto o por fecha.
  // Colapsado en una lupita de costado por defecto para no ocupar tanto lugar.
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSeccion, setFiltroSeccion] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<TipoGasto | 'todos'>('todos');
  const [orden, setOrden] = useState<'recientes' | 'monto'>('recientes');

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

  const gastosFiltrados = gastos
    .filter((g) => !busqueda.trim() || g.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .filter((g) => filtroSeccion === 'todas' || g.categoriaId === filtroSeccion)
    .filter((g) => filtroTipo === 'todos' || g.tipo === filtroTipo)
    .sort((a, b) => (orden === 'monto' ? b.monto - a.monto : b.ts - a.ts));
  const hayFiltrosActivos = !!busqueda.trim() || filtroSeccion !== 'todas' || filtroTipo !== 'todos';

  function agregarDinero() {
    const n = parseMoneyInput(addDispVal);
    if (!n) return;
    setEstado((s) => ({ ...s, disponible: s.disponible + n }));
    setAddDispVal('');
    setAddingDisponible(false);
  }

  function crearCategoria(nombre: string): string {
    const id = slug(nombre);
    setEstado((s) => (s.categorias.some((c) => c.id === id) ? s : { ...s, categorias: [...s.categorias, { id, nombre }] }));
    return id;
  }

  function agregarGasto() {
    const monto = parseMoneyInput(ngMonto);
    if (monto <= 0) return;
    const catId = ngNuevaCat.trim() ? crearCategoria(ngNuevaCat.trim()) : ngCatId;
    if (!catId) return;
    const nuevo: Gasto = { id: String(Date.now()), monto, moneda: ngMoneda, descripcion: ngDesc.trim() || TIPO_INFO[ngTipo].label, categoriaId: catId, tipo: ngTipo, ts: Date.now() };
    setEstado((s) => ({ ...s, gastos: [nuevo, ...s.gastos], disponible: ngMoneda === 'ARS' ? Math.max(s.disponible - monto, 0) : s.disponible }));
    setNgMonto(''); setNgMoneda('ARS'); setNgDesc(''); setNgNuevaCat(''); setNgTipo('necesario');
    setAddingGasto(false);
    setOpenCatId(catId);
  }

  function guardarTope(catId: string) {
    const monto = parseMoneyInput(topeEditMonto[catId] || '');
    if (monto <= 0) return;
    const periodo = topeEditPeriodo[catId] || 'semana';
    setEstado((s) => ({ ...s, topes: { ...s.topes, [catId]: { monto, periodo } } }));
  }

  function reservar() {
    const n = parseMoneyInput(reservaVal);
    if (!n) return;
    setEstado((s) => ({ ...s, reserva: s.reserva + n, disponible: Math.max(s.disponible - n, 0) }));
    setReservaVal('');
    setReservaOpen(false);
  }

  return (
    <div className="px-[22px] pt-8 flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Mis Gastos</h1>
        <p className="text-[13.5px]" style={{ color: COLORS.inkSoft }}>Lo que fuiste contando por WhatsApp.</p>
      </div>
      <Coachmark id="gastos">Acá vas viendo en qué se te va la plata, separado por sección. Podés ponerle un tope semanal o mensual a cada una.</Coachmark>

      {/* Resumen: donut + disponible/gastado */}
      <div className={`bg-white rounded-2xl p-4 ${CARD_SHADOW} flex gap-4 items-center`}>
        <Donut segments={donutCategorias} centerLabel="Gastado" centerValue={fmtMoney(totalGastado)} />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <p className="text-[12px]" style={{ color: COLORS.inkSoft }}>Dinero disponible</p>
            <p className="font-bold text-[19px]" style={{ color: COLORS.ink }}>{fmtMoney(disponible)}</p>
          </div>
          {!addingDisponible ? (
            <button type="button" onClick={() => setAddingDisponible(true)} className="self-start text-[12.5px] font-semibold underline" style={{ color: COLORS.brand }}>
              + Agregar dinero disponible
            </button>
          ) : (
            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                className="flex-1 min-w-0 border border-[rgba(31,27,46,0.16)] rounded-xl px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#7626B3] transition-colors"
                placeholder="Monto"
                inputMode="numeric"
                value={addDispVal}
                onChange={(e) => setAddDispVal(formatThousands(e.target.value))}
              />
              <button type="button" onClick={agregarDinero} className="rounded-xl px-2.5 text-[12px] font-bold shrink-0 text-white transition-all duration-100 active:scale-95" style={{ background: COLORS.brand }}>
                Ok
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Distribución por tipo — la parte que agrega valor: cuánto es impulso vs necesidad */}
      {porTipo.length > 0 && (
        <div className={`bg-white rounded-2xl p-3.5 flex flex-col gap-2 ${CARD_SHADOW}`}>
          <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>¿En qué tipo de gasto se te va?</p>
          <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(31,27,46,0.06)' }}>
            {porTipo.map((t) => (
              <div key={t.tipo} style={{ width: `${(t.monto / totalGastado) * 100}%`, background: TIPO_INFO[t.tipo].color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {porTipo.map((t) => (
              <span key={t.tipo} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: COLORS.inkSoft }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_INFO[t.tipo].color }} />
                {TIPO_INFO[t.tipo].label} · {fmtMoney(t.monto)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agregar gasto */}
      {!addingGasto ? (
        <>
          <Cta label="+ Agregar gasto" onClick={() => setAddingGasto(true)} />
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-medium transition-all duration-100 active:scale-[0.99]"
            style={{ background: COLORS.tint, color: COLORS.brandDark }}
          >
            <span className="text-lg shrink-0">💬</span>
            <span className="flex-1">También los podés registrar hablándole a tu bot de WhatsApp — el mismo botón redondo de abajo.</span>
          </a>
        </>
      ) : (
        <div className={`bg-white rounded-2xl p-4 flex flex-col gap-3 ${CARD_SHADOW}`}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute top-1/2 -translate-y-1/2 left-4" style={{ color: COLORS.inkSoft }}>{ngMoneda === 'USD' ? 'US$' : '$'}</span>
              <input
                autoFocus
                className="w-full border border-[rgba(31,27,46,0.16)] rounded-xl pl-10 pr-3 py-2.5 text-[14.5px] outline-none focus:border-[#7626B3] transition-colors"
                placeholder="Monto"
                inputMode="numeric"
                value={ngMonto}
                onChange={(e) => setNgMonto(formatThousands(e.target.value))}
              />
            </div>
            <div className="flex rounded-xl overflow-hidden border border-[rgba(31,27,46,0.16)] shrink-0">
              {(['ARS', 'USD'] as Moneda[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNgMoneda(m)}
                  className="px-2.5 text-[12px] font-bold transition-colors"
                  style={ngMoneda === m ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <input
            className="border border-[rgba(31,27,46,0.16)] rounded-xl px-3.5 py-2.5 text-[14.5px] outline-none focus:border-[#7626B3] transition-colors"
            placeholder="Descripción (ej: PedidosYa)"
            value={ngDesc}
            onChange={(e) => setNgDesc(e.target.value)}
          />

          <div>
            <p className="text-[12px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>Sección</p>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => {
                const sel = ngCatId === c.id && !ngNuevaCat;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setNgCatId(c.id); setNgNuevaCat(''); }}
                    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all duration-100 active:scale-95"
                    style={sel ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
                  >
                    {c.nombre}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setNgCatId(null); setNgNuevaCat(' '); }}
                className="rounded-xl px-3 py-1.5 text-[13px] font-semibold border border-dashed transition-all duration-100 active:scale-95"
                style={{ background: ngNuevaCat ? COLORS.brandSoft : '#fff', color: ngNuevaCat ? COLORS.brandDark : COLORS.ink, borderColor: 'rgba(31,27,46,0.25)' }}
              >
                + Nueva
              </button>
            </div>
            {ngNuevaCat && (
              <input
                autoFocus
                className="mt-2 w-full border border-[rgba(31,27,46,0.16)] rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#7626B3] transition-colors"
                placeholder="Nombre de la sección"
                value={ngNuevaCat.trim()}
                onChange={(e) => setNgNuevaCat(e.target.value || ' ')}
              />
            )}
          </div>

          <div>
            <p className="text-[12px] font-bold mb-1.5" style={{ color: COLORS.inkSoft }}>¿Qué tipo de gasto fue?</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => {
                const sel = ngTipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNgTipo(t)}
                    className="rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all duration-100 active:scale-95"
                    style={sel ? { background: TIPO_INFO[t].color, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
                  >
                    {TIPO_INFO[t].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <button type="button" onClick={() => setAddingGasto(false)} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold border border-[rgba(31,27,46,0.16)]" style={{ color: COLORS.ink }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={agregarGasto}
              disabled={parseMoneyInput(ngMonto) <= 0 || (!ngCatId && !ngNuevaCat.trim())}
              className="flex-[2] rounded-xl py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40 transition-all duration-100 active:scale-95"
              style={{ background: COLORS.brand }}
            >
              Agregar gasto
            </button>
          </div>
        </div>
      )}

      {/* Sobres por categoría */}
      <div className="flex flex-col gap-3">
        {categorias.length === 0 && (
          <p className="text-[13px] px-1" style={{ color: COLORS.inkSoft }}>
            Todavía no tenés secciones — se crean solas cuando agregás tu primer gasto.
          </p>
        )}
        {categorias.map((cat) => {
          const open = openCatId === cat.id;
          const gastado = gastadoEn(cat.id);
          const tope = topes[cat.id];
          const movs = gastos.filter((g) => g.categoriaId === cat.id);
          return (
            <div key={cat.id} className={`bg-white rounded-2xl p-4 ${CARD_SHADOW}`}>
              <button type="button" className="w-full flex items-center justify-between" onClick={() => setOpenCatId(open ? null : cat.id)}>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorDe(cat.id) }} />
                  <div className="text-left">
                    <p className="font-semibold text-[14.5px]" style={{ color: COLORS.ink }}>{cat.nombre}</p>
                    <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>{gastado > 0 ? fmtMoney(gastado) : 'Sin registros todavía'}</p>
                  </div>
                </div>
                <span style={{ color: COLORS.inkFaint }}>{open ? '▲' : '▼'}</span>
              </button>

              {tope ? (
                <div className="mt-3">
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(31,27,46,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((gastado / tope.monto) * 100, 100)}%`, background: colorDe(cat.id) }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[12px]">
                    <span style={{ color: COLORS.inkSoft }}>Tope: {fmtMoney(tope.monto)}/{tope.periodo === 'semana' ? 'sem' : 'mes'}</span>
                    <button type="button" className="font-semibold underline" style={{ color: COLORS.brand }} onClick={() => setOpenCatId(cat.id)}>Editar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl px-3 py-2 text-[12px] font-semibold" style={{ background: COLORS.goldSoft, color: COLORS.ink }}>
                  👀 Por ahora, estamos mirando cómo es tu {cat.nombre.toLowerCase()}
                </div>
              )}

              {open && (
                <div className="mt-3 pt-3 border-t border-dashed flex flex-col gap-2" style={{ borderColor: 'rgba(31,27,46,0.14)' }}>
                  {movs.length === 0 && <p className="text-[12.5px]" style={{ color: COLORS.inkSoft }}>Todavía no hay movimientos acá.</p>}
                  {movs.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-[13px] gap-2" style={{ color: COLORS.ink }}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_INFO[m.tipo].color }} />
                        <span className="truncate">{m.descripcion} · {fechaDisplay(m.ts)}</span>
                      </span>
                      <span className="shrink-0" style={{ color: COLORS.inkSoft }}>{fmtGasto(m)}</span>
                    </div>
                  ))}
                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <p className="text-[12px] font-semibold" style={{ color: COLORS.inkSoft }}>Tope de la sección</p>
                    <div className="relative">
                      <span className="absolute top-1/2 -translate-y-1/2 left-3.5" style={{ color: COLORS.inkSoft }}>$</span>
                      <input
                        className="w-full border border-[rgba(31,27,46,0.16)] rounded-xl pl-7 pr-3 py-2 text-[13px] outline-none focus:border-[#7626B3] transition-colors"
                        placeholder="Monto"
                        inputMode="numeric"
                        value={topeEditMonto[cat.id] ?? (tope ? String(tope.monto) : '')}
                        onChange={(e) => setTopeEditMonto((v) => ({ ...v, [cat.id]: formatThousands(e.target.value) }))}
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <SegmentedTab
                          options={[{ id: 'semana' as Periodo, label: 'Por semana' }, { id: 'mes' as Periodo, label: 'Por mes' }]}
                          value={topeEditPeriodo[cat.id] ?? tope?.periodo ?? 'semana'}
                          onChange={(p) => setTopeEditPeriodo((v) => ({ ...v, [cat.id]: p }))}
                          trackColor={COLORS.tint}
                        />
                      </div>
                      <button
                        type="button"
                        className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-bold text-white transition-all duration-100 active:scale-95 shrink-0"
                        style={{ background: COLORS.brand }}
                        onClick={() => guardarTope(cat.id)}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Buscador de gastos — colapsado en una lupita, no ocupa lugar hasta que se usa */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Tus gastos</p>
          <button
            type="button"
            onClick={() => setBusquedaAbierta((v) => !v)}
            aria-label="Buscar gastos"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={busquedaAbierta ? { background: COLORS.brand, color: '#fff' } : { background: COLORS.tint, color: COLORS.brand }}
          >
            🔍
          </button>
        </div>
        {busquedaAbierta && (
          <input
            autoFocus
            className="border border-[rgba(31,27,46,0.16)] focus:border-[#7626B3] rounded-2xl px-4 py-2.5 text-[14px] bg-white outline-none transition-colors"
            placeholder="Buscar por nombre (ej: Rappi)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        )}
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltroSeccion('todas')}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-100 active:scale-95"
              style={filtroSeccion === 'todas' ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
            >
              Todas las secciones
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFiltroSeccion(c.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-100 active:scale-95"
                style={filtroSeccion === c.id ? { background: COLORS.brand, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltroTipo('todos')}
            className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-100 active:scale-95"
            style={filtroTipo === 'todos' ? { background: COLORS.ink, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
          >
            Todos los tipos
          </button>
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltroTipo(t)}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-100 active:scale-95"
              style={filtroTipo === t ? { background: TIPO_INFO[t].color, color: '#fff' } : { background: '#fff', color: COLORS.ink, border: '1px solid rgba(31,27,46,0.16)' }}
            >
              {TIPO_INFO[t].label}
            </button>
          ))}
        </div>
        <SegmentedTab
          options={[{ id: 'recientes' as const, label: 'Más recientes' }, { id: 'monto' as const, label: 'Mayor monto' }]}
          value={orden}
          onChange={setOrden}
          trackColor={COLORS.tint}
        />

        {gastos.length === 0 && <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste gastos.</p>}
        {gastos.length > 0 && gastosFiltrados.length === 0 && (
          <p className="text-[13px]" style={{ color: COLORS.inkSoft }}>No encontramos gastos con esos filtros.</p>
        )}
        {gastosFiltrados.slice(0, hayFiltrosActivos ? 50 : 6).map((g) => {
          const cat = categorias.find((c) => c.id === g.categoriaId);
          return (
            <div key={g.id} className={`flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 ${CARD_SHADOW}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TIPO_INFO[g.tipo].color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] truncate" style={{ color: COLORS.ink }}>{g.descripcion}</p>
                <p className="text-[11.5px]" style={{ color: COLORS.inkSoft }}>{cat?.nombre ?? 'Sin sección'} · {fechaDisplay(g.ts)}</p>
              </div>
              <span className="font-semibold text-[13.5px] shrink-0" style={{ color: COLORS.ink }}>{fmtGasto(g)}</span>
            </div>
          );
        })}
      </div>

      {/* Reserva tipo ahorro */}
      <div className={`bg-white rounded-2xl p-4 ${CARD_SHADOW}`}>
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.goldSoft }}>🔒</span>
          <p className="flex-1 text-[14.5px] font-semibold" style={{ color: COLORS.ink }}>Reserva</p>
          <button type="button" onClick={() => setReservaOpen((o) => !o)} className="text-[13px] font-semibold underline shrink-0" style={{ color: COLORS.brand }}>
            {reserva > 0 ? 'Editar' : 'Reservar'}
          </button>
        </div>

        {reserva > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl px-3 py-2.5" style={{ background: COLORS.goldSoft }}>
              <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>En reserva</p>
              <p className="font-bold text-[15px]" style={{ color: COLORS.ink }}>{fmtMoney(reserva)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: COLORS.paper }}>
              <p className="text-[11px]" style={{ color: COLORS.inkSoft }}>Disponible libre</p>
              <p className="font-bold text-[15px]" style={{ color: COLORS.ink }}>{fmtMoney(disponible)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px]" style={{ color: COLORS.inkSoft }}>Apartá un monto para no gastarlo — tipo alcancía.</p>
        )}

        {reservaOpen && (
          <div className="mt-3 pt-3 border-t border-dashed flex gap-2" style={{ borderColor: 'rgba(31,27,46,0.14)' }}>
            <input
              autoFocus
              className="flex-1 border border-[rgba(31,27,46,0.16)] rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#7626B3] transition-colors"
              placeholder="¿Cuánto querés reservar?"
              inputMode="numeric"
              value={reservaVal}
              onChange={(e) => setReservaVal(formatThousands(e.target.value))}
            />
            <button type="button" onClick={reservar} className="rounded-xl px-3.5 text-[12.5px] font-bold text-white transition-all duration-100 active:scale-95" style={{ background: COLORS.brand }}>
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

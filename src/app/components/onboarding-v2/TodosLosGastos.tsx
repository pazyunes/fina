import { useMemo, useState } from 'react';
import { BotonVolver, COLORS, SegmentedTab, Titulo, useVolver } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { IconCalendario, IconLupa } from './FinaIcons';
import { FilaGasto } from './FilaGasto';
import { Desplegable, INPUT_STYLE } from './FormularioGasto';
import { gastosDeLaBase, seccionesDeLaBase } from './datosGasto';

// Todos tus gastos, de todos los períodos. Se llega desde "Consultar todos" en
// Gastos, que muestra sólo los últimos 5: la lista completa, con buscador,
// filtro por sección y por fechas, vive acá para que Gastos no repita el mismo
// listado. Editar abre el formulario en el mismo renglón.

const OPCION: React.CSSProperties = { color: COLORS.ink };

// Un campo de fecha con su ícono y su nombre arriba: sin el ícono no se
// entendía que era para poner una fecha. Ocupa todo su ancho (min-w-0) para
// que los dos no se pisen en un celular angosto.
function CampoFecha({ id, label, value, min, max, onChange }: {
  id: string; label: string; value: string; min?: string; max?: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>
        <IconCalendario size={16} /> {label}
      </label>
      <input
        id={id}
        type="date"
        className="v2-focus w-full min-w-0 rounded-xl px-3 min-h-[44px] text-[14px] transition-colors"
        style={{ ...INPUT_STYLE, color: value ? COLORS.ink : COLORS.inkFaint }}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TodosLosGastos() {
  const volver = useVolver('/onboarding-v2/gastos');
  const { estado: db } = useAlmacen();
  const gastos = useMemo(() => gastosDeLaBase(db), [db]);
  const { categorias } = useMemo(() => seccionesDeLaBase(db), [db]);

  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [seccion, setSeccion] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'monto'>('recientes');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  // Lo desplegado en la lista (editar o borrar), de a un gasto por vez.
  const [abierto, setAbierto] = useState<{ id: string; que: 'editar' | 'borrar' } | null>(null);

  const hayBusqueda = !!busqueda.trim();
  const hayFiltroFecha = !!(filtroDesde || filtroHasta);
  const hayFiltro = hayBusqueda || hayFiltroFecha || !!seccion;
  const filtrados = gastos
    .filter((g) => !hayBusqueda || g.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .filter((g) => !seccion || (seccion === '__sin' ? !g.categoriaId : g.categoriaId === seccion))
    .filter((g) => !filtroDesde || g.ts >= new Date(`${filtroDesde}T00:00:00`).getTime())
    .filter((g) => !filtroHasta || g.ts <= new Date(`${filtroHasta}T23:59:59`).getTime())
    // "Mayor monto" compara en pesos: ordenar por `monto` pondría US$20 abajo
    // de un gasto de $5.000, que es al revés.
    .sort((a, b) => (orden === 'monto' ? b.montoArs - a.montoArs : b.ts - a.ts));

  function limpiar() {
    setBusqueda(''); setSeccion(''); setFiltroDesde(''); setFiltroHasta('');
  }

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-3 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <div className="flex items-center justify-between gap-2">
          <Titulo>Todos tus gastos</Titulo>
          <button
            type="button"
            onClick={() => setBusquedaAbierta((v) => !v)}
            aria-label="Buscar y filtrar gastos"
            aria-pressed={busquedaAbierta}
            className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={busquedaAbierta ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.tint, color: COLORS.brand }}
          >
            <IconLupa size={18} />
          </button>
        </div>
      </header>

      {busquedaAbierta && (
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            aria-label="Buscar gastos por nombre"
            className="v2-focus rounded-xl px-4 min-h-[44px] text-[15px] transition-colors"
            style={INPUT_STYLE}
            placeholder="Buscar por nombre (ej: Rappi)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Desplegable id="filtro-seccion" label="Sección" value={seccion} onChange={setSeccion}>
            <option value="" style={OPCION}>Todas las secciones</option>
            {categorias.map((c) => <option key={c.id} value={c.id} style={OPCION}>{c.nombre}</option>)}
            <option value="__sin" style={OPCION}>Sin sección</option>
          </Desplegable>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CampoFecha id="filtro-desde" label="Desde" value={filtroDesde} max={filtroHasta || undefined} onChange={setFiltroDesde} />
            <CampoFecha id="filtro-hasta" label="Hasta" value={filtroHasta} min={filtroDesde || undefined} onChange={setFiltroHasta} />
          </div>
          {hayFiltro && (
            <button type="button" onClick={limpiar} className="v2-focus self-start min-h-[44px] text-[14px] font-semibold underline" style={{ color: COLORS.inkSoft }}>
              Sacar los filtros
            </button>
          )}
        </div>
      )}

      <SegmentedTab
        options={[{ id: 'recientes' as const, label: 'Más recientes' }, { id: 'monto' as const, label: 'Mayor monto' }]}
        value={orden}
        onChange={setOrden}
        trackColor={COLORS.tint}
      />

      <div className="flex flex-col">
        {gastos.length === 0 && <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Todavía no registraste gastos.</p>}
        {gastos.length > 0 && filtrados.length === 0 && (
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>No encontramos gastos con esos filtros.</p>
        )}
        {filtrados.map((g) => (
          <FilaGasto
            key={g.id}
            gasto={g}
            categorias={categorias}
            abierto={abierto?.id === g.id ? abierto.que : null}
            onAbrir={(que) => setAbierto(que ? { id: g.id, que } : null)}
          />
        ))}
      </div>
    </div>
  );
}

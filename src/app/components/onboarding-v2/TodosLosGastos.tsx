import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BotonVolver, COLORS, SegmentedTab, Titulo, useVolver } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { IconLupa } from './FinaIcons';
import { FilaGasto, gastosDeLaBase } from './FilaGasto';

// Todos tus gastos, de todos los períodos. Se llega desde "Consultar todos" en
// Gastos, que muestra sólo los últimos 7: la lista completa, con buscador y
// filtro de fechas, vive acá para que Gastos no repita el mismo listado.
//
// Editar un gasto lleva a Gastos con el formulario abierto: es el mismo
// formulario que para cargar uno, y tenerlo en dos pantallas sería mantenerlo
// dos veces.

const INPUT_STYLE: React.CSSProperties = { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` };

export function TodosLosGastos() {
  const navigate = useNavigate();
  const volver = useVolver('/onboarding-v2/gastos');
  const { estado: db } = useAlmacen();
  const gastos = useMemo(() => gastosDeLaBase(db), [db]);
  const categorias = useMemo(() => db.secciones.map((s) => ({ id: s.id, nombre: s.nombre })), [db]);

  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'monto'>('recientes');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');
  const [borrando, setBorrando] = useState<string | null>(null);

  const hayBusqueda = !!busqueda.trim();
  const hayFiltroFecha = !!(filtroDesde || filtroHasta);
  const filtrados = gastos
    .filter((g) => !hayBusqueda || g.descripcion.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .filter((g) => !filtroDesde || g.ts >= new Date(`${filtroDesde}T00:00:00`).getTime())
    .filter((g) => !filtroHasta || g.ts <= new Date(`${filtroHasta}T23:59:59`).getTime())
    // "Mayor monto" compara en pesos: ordenar por `monto` pondría US$20 abajo
    // de un gasto de $5.000, que es al revés.
    .sort((a, b) => (orden === 'monto' ? b.montoArs - a.montoArs : b.ts - a.ts));

  return (
    <div className="px-[22px] pt-6 flex flex-col gap-4 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-8">
      <header className="flex flex-col gap-2">
        <BotonVolver onClick={volver} />
        <div className="flex items-center justify-between gap-2">
          <Titulo>Todos tus gastos</Titulo>
          <button
            type="button"
            onClick={() => setBusquedaAbierta((v) => !v)}
            aria-label="Buscar gastos"
            aria-pressed={busquedaAbierta}
            className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={busquedaAbierta ? { background: COLORS.brand, color: COLORS.surface } : { background: COLORS.tint, color: COLORS.brand }}
          >
            <IconLupa size={18} />
          </button>
        </div>
      </header>

      {busquedaAbierta && (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            aria-label="Buscar gastos por nombre"
            className="v2-focus rounded-2xl px-4 py-2.5 text-[15px] transition-colors"
            style={INPUT_STYLE}
            placeholder="Buscar por nombre (ej: Rappi)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="filtro-desde" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Desde</label>
              <input
                id="filtro-desde"
                type="date"
                className="v2-focus w-full rounded-xl px-3 py-2 text-[14px] transition-colors"
                style={INPUT_STYLE}
                value={filtroDesde}
                max={filtroHasta || undefined}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="filtro-hasta" className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Hasta</label>
              <input
                id="filtro-hasta"
                type="date"
                className="v2-focus w-full rounded-xl px-3 py-2 text-[14px] transition-colors"
                style={INPUT_STYLE}
                value={filtroHasta}
                min={filtroDesde || undefined}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
            </div>
            {hayFiltroFecha && (
              <button
                type="button"
                onClick={() => { setFiltroDesde(''); setFiltroHasta(''); }}
                aria-label="Sacar el filtro de fecha"
                className="v2-focus self-end min-h-[44px] text-[14px] font-semibold underline"
                style={{ color: COLORS.inkSoft }}
              >
                Sacar
              </button>
            )}
          </div>
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
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>
            {hayFiltroFecha && hayBusqueda ? 'No encontramos gastos con ese nombre en ese rango de fechas.'
              : hayFiltroFecha ? 'No encontramos gastos en ese rango de fechas.'
              : 'No encontramos gastos con ese nombre.'}
          </p>
        )}
        {filtrados.map((g) => (
          <FilaGasto
            key={g.id}
            gasto={g}
            categorias={categorias}
            borrando={borrando === g.id}
            onBorrar={() => setBorrando(borrando === g.id ? null : g.id)}
            onEditar={() => navigate('/onboarding-v2/gastos', { state: { editarGasto: g.id, from: '/onboarding-v2/gastos/todos' } })}
          />
        ))}
      </div>
    </div>
  );
}

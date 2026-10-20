import { useNavigate } from 'react-router';
import { COLORS } from './shared';
import { IconChevron } from './FinaIcons';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina, parsearHorizonte } from '../../utils/goalStrategies';

// En Inicio, el día que toca un gasto planificado (la psicóloga, una cuota):
// una fila que pregunta si se usó y lleva a Mis planes, donde se anota. Un
// botón que lleva a otra pantalla, no un formulario acá (CLAUDE.md regla 12).
// Si hay más de uno, se dice cuántos.
export function PlanesDeHoy() {
  const navigate = useNavigate();
  const { estado, listo } = useAlmacen();
  if (!listo) return null;
  const hoy = diaArgentina();
  const tocan = estado.objetivos.filter((o) => {
    if (o.clase !== 'gasto' || o.estado === 'cancelled' || (o.estado === 'achieved' && !o.repite)) return false;
    const fecha = parsearHorizonte(o.horizonte, hoy);
    return !!fecha && fecha <= hoy;
  });
  if (tocan.length === 0) return null;
  const texto = tocan.length === 1 ? `Tocaba ${tocan[0].nombre}. ¿Lo usaste?` : `Tocaban ${tocan.length} gastos planificados. ¿Los usaste?`;

  return (
    <button
      type="button"
      onClick={() => navigate('/onboarding-v2/objetivos', { state: { from: '/onboarding-v2/home' } })}
      className="v2-focus w-full flex items-center gap-2 rounded-2xl px-4 min-h-[48px] text-left -mt-2"
      style={{ background: COLORS.limaSoft }}
    >
      <span className="flex-1 min-w-0 text-[13px] font-semibold" style={{ color: COLORS.ink }}>{texto}</span>
      <span style={{ color: COLORS.limaText }} aria-hidden><IconChevron size={16} /></span>
    </button>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';
import { cartelDeHoy, cerrarCartelInvertir, GASTOS_PARA_EL_CARTEL } from '../../lib/cartelInvertir';
import { COLORS } from './shared';
import { IconChevron, IconClose } from './FinaIcons';

// Para quien todavía no invierte: cada tanto, una fila en Inicio que lleva a
// Inversiones (Inicio es un tablero de entradas). Se puede cerrar, y no vuelve
// hasta pasados unos días. No dice que tenga que hacerlo: muestra que puede.

const FRASES = [
  { titulo: 'Todavía no invertís', linea: 'Mirá en qué podrías empezar según tu perfil.' },
  { titulo: 'Tu plata puede trabajar', linea: 'Mirá opciones para empezar con poco.' },
  { titulo: 'Invertir paso a paso', linea: 'FINA te muestra opciones y cómo hacerlo.' },
];

export function InvertirEnInicio() {
  const { estado, listo } = useAlmacen();
  const navigate = useNavigate();
  const hoy = diaArgentina();
  const [cerrado, setCerrado] = useState(false);

  // No invierte: sin inversiones activas, sin aportes registrados y sin haber dicho que invierte por su cuenta.
  const noInvierte = listo
    && estado.posiciones.every((p) => p.estado !== 'activa')
    && estado.aportes.length === 0
    && estado.perfilInversor?.yaInvierte !== true
    && estado.gastos.length >= GASTOS_PARA_EL_CARTEL;
  // Se decide una vez por visita: `cartelDeHoy` anota que se mostró.
  const frase = useMemo(() => (noInvierte ? cartelDeHoy(hoy, FRASES.length) : null), [noInvierte, hoy]);

  if (frase === null || cerrado) return null;
  const { titulo, linea } = FRASES[frase];

  return (
    <div className="flex items-center rounded-2xl pl-4 pr-1" style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}>
      <button
        type="button"
        onClick={() => { cerrarCartelInvertir(hoy); navigate('/onboarding-v2/inversiones'); }}
        className="v2-focus flex-1 min-w-0 text-left py-3 flex items-center gap-3"
      >
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[13px] font-bold truncate" style={{ color: COLORS.ink }}>{titulo}</span>
          <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>{linea}</span>
        </span>
        <IconChevron size={16} style={{ color: COLORS.inkSoft }} />
      </button>
      <button
        type="button"
        onClick={() => { cerrarCartelInvertir(hoy); setCerrado(true); }}
        aria-label="Cerrar"
        className="v2-focus w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ color: COLORS.inkFaint }}
      >
        <IconClose size={16} />
      </button>
    </div>
  );
}

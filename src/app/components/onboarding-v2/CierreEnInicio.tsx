import { useState } from 'react';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { diaArgentina } from '../../api/v2/pasos';
import { mesACerrar } from '../../lib/cierreDeMes';
import { cierreVisto } from '../../lib/cierreLocal';
import { COLORS } from './shared';
import { IconChevron } from './FinaIcons';
import { CierreDeMes } from './CierreDeMes';
import { useAlLlegar } from './alLlegar';

// En Inicio, los últimos días del mes y los primeros del siguiente: una fila
// que abre el cierre. Desaparece cuando se vio. El aviso del 1.º del mes abre
// el cierre directo, aunque ya se haya visto.

export function CierreEnInicio() {
  const { estado, listo } = useAlmacen();
  const mes = mesACerrar(diaArgentina());
  const [abierto, setAbierto] = useState(false);
  const [visto, setVisto] = useState(() => (mes ? cierreVisto(mes.clave) : true));
  useAlLlegar('cierre', () => setAbierto(true));

  if (!listo || !mes) return null;
  // Sin nada anotado todavía no hay mes que cerrar.
  if (estado.gastos.length === 0 && estado.ingresos.length === 0) return null;

  return (
    <>
      {!visto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="v2-focus w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-transform duration-100 active:scale-[0.99]"
          style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}
        >
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-[13px] font-bold truncate" style={{ color: COLORS.ink }}>
              {mes.terminado ? `Cómo cerró ${mes.nombre}` : `Se termina ${mes.nombre}`}
            </span>
            <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>Mirá cómo te fue y armá {mes.siguiente.nombre}.</span>
          </span>
          <IconChevron size={16} style={{ color: COLORS.inkSoft }} />
        </button>
      )}
      {abierto && <CierreDeMes mes={mes} onCerrar={() => { setAbierto(false); setVisto(true); }} />}
    </>
  );
}

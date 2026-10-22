import type { Colchon, SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { fmtPesos } from '../../../lib/inversiones/formato';
import { COLORS, EstadoConfianza, Rango, TituloSeccion } from '../shared';
import { Parrafo } from './Hoja';

// "¿Cuánto te conviene poner?" Sale de lo que a la persona le queda cada mes:
// se parte del peor mes de los últimos tres, no del promedio, y el primer monto
// es chico a propósito. Si hoy no sobra, se dice sin rodeos y no se bloquea
// nada: se puede mirar y simular igual.
export function CuantoPoner({ sugerencia, colchon }: { sugerencia: SugerenciaMonto; colchon: Colchon | null }) {
  const sinBase = sugerencia.tipo === 'por-descubrir';
  return (
    <section className="flex flex-col gap-3" aria-labelledby="cuanto-titulo">
      <div id="cuanto-titulo"><TituloSeccion>Cuánto te conviene poner</TituloSeccion></div>

      {sugerencia.monto && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>Por mes</p>
          <Rango min={sugerencia.monto.min} max={sugerencia.monto.max} />
          <EstadoConfianza estado="estimado" />
        </div>
      )}
      {sinBase && <EstadoConfianza estado="por-descubrir" />}

      <div className="flex flex-col gap-2">
        {sugerencia.mensajes.map((m) => <Parrafo key={m}>{m}</Parrafo>)}
      </div>

      {colchon && colchon.meta > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 pl-3.5 border-l-2" style={{ borderColor: colchon.cubierto ? COLORS.lima : COLORS.star }}>
          <p className="text-[14px] font-semibold" style={{ color: COLORS.ink }}>Tu colchón: plata a mano para imprevistos</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }} aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (colchon.actual / colchon.meta) * 100)}%`, background: colchon.cubierto ? COLORS.lima : COLORS.star }}
            />
          </div>
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
            Tenés <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{fmtPesos(colchon.actual)}</span> de{' '}
            <span className="font-mono tabular-nums">{fmtPesos(colchon.meta)}</span> (tres meses de tus gastos).{' '}
            {colchon.cubierto
              ? 'Ya lo tenés cubierto: podés pensar en opciones a más largo plazo.'
              : 'Conviene completarlo primero en algo que puedas sacar rápido, antes de dejar plata quieta mucho tiempo.'}
          </p>
        </div>
      )}
    </section>
  );
}

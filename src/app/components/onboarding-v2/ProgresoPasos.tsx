import { BotonVolver, COLORS, FONTS, Titulo, useVolver } from './shared';
import { useProximoPaso } from '../../api/v2/ProximoPasoProvider';
import { fraseDeProgreso } from '../../api/v2/proximoPaso';

// Tu progreso: los pasos grandes que ya hiciste y los que vienen. Se llega
// tocando el próximo paso en Inicio o desde el festejo al completar uno.
//
// El dato central es cuántos hiciste, con la barra en lima (el color del
// avance, §5.3). La frase de abajo tiene el dato atrás: no felicita en el
// vacío ni reta si todavía no hiciste ninguno.

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

function Check() {
  return (
    <svg width={12} height={10} viewBox="0 0 14 11" fill="none" aria-hidden>
      <path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProgresoPasos() {
  const volver = useVolver();
  const { progreso, hechos, paso, listo } = useProximoPaso();
  const pct = hechos.total > 0 ? Math.round((hechos.hechos / hechos.total) * 100) : 0;

  return (
    <div className="px-[22px] pt-4 flex flex-col gap-5 pb-4 lg:max-w-2xl lg:mx-auto lg:pt-6">
      <header className="flex flex-col gap-1">
        <BotonVolver onClick={volver} />
        <Titulo>Tu progreso</Titulo>
      </header>

      {!listo ? (
        <div className="rounded-2xl h-[120px]" style={{ background: COLORS.tint }} aria-label="Cargando tu progreso" />
      ) : (
        <>
          <section className="flex flex-col gap-2" aria-label="Pasos grandes hechos">
            <p className="text-[32px] font-bold leading-none tabular-nums" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
              {hechos.hechos} <span className="text-[18px] font-semibold" style={{ color: COLORS.inkSoft }}>de {hechos.total} pasos grandes</span>
            </p>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: COLORS.line }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COLORS.limaViz }} />
            </div>
            <p className="text-[15px] leading-snug pt-1" style={{ color: COLORS.ink }}>{fraseDeProgreso(hechos.hechos, hechos.total)}</p>
          </section>

          <ul className="flex flex-col" aria-label="Tus pasos grandes">
            {progreso.map((p) => {
              const esElProximo = !p.hecho && paso?.clave === p.clave;
              return (
                <li key={p.clave} className="flex items-center gap-3 py-3.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={p.hecho ? { background: COLORS.lima, color: COLORS.ink } : { border: `2px solid ${esElProximo ? COLORS.brand : COLORS.lineStrong}` }}
                    aria-label={p.hecho ? 'Hecho' : 'Pendiente'}
                  >
                    {p.hecho && <Check />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold" style={{ color: p.hecho || esElProximo ? COLORS.ink : COLORS.inkSoft }}>{p.titulo}</span>
                    <span className="block text-[14px]" style={{ color: p.hecho ? COLORS.limaText : esElProximo ? COLORS.brand : COLORS.inkFaint }}>
                      {p.hecho
                        ? (p.completadoEn ? `Hecho el ${fecha(p.completadoEn)}` : 'Hecho')
                        : esElProximo ? 'Tu próximo paso' : 'Más adelante'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

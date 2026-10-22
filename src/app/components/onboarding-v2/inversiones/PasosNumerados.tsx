import { fmtPesos } from '../../../lib/inversiones/formato';
import type { Guia, PasoGuia } from '../../../lib/inversiones/guias';
import { BotonFantasma, COLORS, Cta } from '../shared';

// Los pasos de una inversión, numerados. El número se ve en todos: en los que ya
// hiciste (lima), en el que estás mirando (violeta) y en los que faltan. Se puede
// ir para adelante y para atrás, y tocar cualquier paso para releerlo.
export function PasosNumerados({
  guia, monto, hechos, abierto, onAbrir, onHacer, onDeshacer, onVerBasico, onRegistrar,
}: {
  guia: Guia;
  monto: number | null;
  hechos: number[];
  abierto: number;
  onAbrir: (i: number) => void;
  onHacer: (i: number, paso: PasoGuia) => void;
  onDeshacer: (i: number) => void;
  onVerBasico: () => void;
  onRegistrar: () => void;
}) {
  const total = guia.pasos.length;
  const terminada = hechos.length === total;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>
          {terminada ? `Hiciste los ${total} pasos` : `${hechos.length} de ${total} pasos hechos`}
          {monto ? ` · con ${fmtPesos(monto)}` : ''}
        </p>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }} aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${(hechos.length / total) * 100}%`, background: COLORS.lima }} />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {guia.pasos.map((paso, i) => {
          const hecho = hechos.includes(i);
          const expandido = abierto === i;
          return (
            <li key={paso.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => onAbrir(expandido ? -1 : i)}
                aria-expanded={expandido}
                className="v2-focus flex items-center gap-3 min-h-[52px] text-left"
              >
                <NumeroPaso n={i + 1} hecho={hecho} actual={expandido} />
                <span className="flex-1 min-w-0 text-[16px] leading-snug" style={{ color: expandido ? COLORS.ink : hecho ? COLORS.inkSoft : COLORS.inkFaint, fontWeight: expandido ? 700 : 500 }}>
                  {paso.titulo}
                </span>
                {hecho && <span className="text-[13px] font-semibold shrink-0" style={{ color: COLORS.limaText }}>Hecho</span>}
              </button>

              {expandido && (
                <div className="flex flex-col gap-3.5 rounded-2xl p-4 mt-1 mb-2" style={{ border: `1.5px solid ${COLORS.brand}`, background: COLORS.surface }}>
                  <Bloque t="Qué hacés" x={paso.haces} fuerte />
                  <Bloque t="Cómo se ve" x={paso.loVes} />
                  <Bloque t="Qué lográs con esto" x={paso.lograras} />
                  {paso.datos && paso.datos.length > 0 && (
                    <div className="flex flex-col pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
                      {paso.datos.map((d) => (
                        <p key={`${d.etiqueta}-${d.valor}`} className="text-[14px] leading-snug py-0.5" style={{ color: COLORS.inkSoft }}>
                          {d.etiqueta}: <span className="font-mono tabular-nums font-semibold" style={{ color: COLORS.ink }}>{d.valor}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <Bloque t="Sabés que salió bien cuando" x={paso.chequeo} />

                  {hecho && !paso.registra ? (
                    <>
                      {i < total - 1 && <Cta label="Ir al paso siguiente" onClick={() => onAbrir(i + 1)} />}
                      <BotonFantasma label="Marcar como pendiente" onClick={() => onDeshacer(i)} />
                    </>
                  ) : (
                    <Cta label={paso.registra ? 'Anotarla en FINA' : 'Ya lo hice'} onClick={() => onHacer(i, paso)} />
                  )}
                  {i > 0 && <BotonFantasma label="← Volver al paso anterior" onClick={() => onAbrir(i - 1)} />}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {terminada && (
        <div className="flex flex-col gap-2">
          <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>Listo: {guia.alTerminar.charAt(0).toLowerCase() + guia.alTerminar.slice(1)}</p>
          <Cta label="Anotarla en FINA" onClick={onRegistrar} />
        </div>
      )}

      <BotonFantasma label="Ver de nuevo lo básico" onClick={onVerBasico} />
    </>
  );
}

/** El número del paso, siempre visible: lleno de lima si ya está hecho, violeta si es el que estás mirando. */
function NumeroPaso({ n, hecho, actual }: { n: number; hecho: boolean; actual: boolean }) {
  const estilo = actual
    ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
    : hecho
      ? { background: COLORS.lima, color: COLORS.ink, border: `1.5px solid ${COLORS.lima}` }
      : { background: COLORS.surface, color: COLORS.inkFaint, border: `1.5px solid ${COLORS.lineStrong}` };
  return (
    <span
      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[15px] font-bold font-mono tabular-nums"
      style={estilo}
      aria-label={`Paso ${n}${hecho ? ', hecho' : ''}`}
    >
      {n}
    </span>
  );
}

function Bloque({ t, x, fuerte = false }: { t: string; x: string; fuerte?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[13px] font-bold" style={{ color: COLORS.inkFaint }}>{t}</p>
      <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: fuerte ? COLORS.ink : COLORS.inkSoft, fontWeight: fuerte ? 600 : 400 }}>{x}</p>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { COLORS, FONTS } from './shared';
import { IconChevron } from './FinaIcons';
import { useProximoPaso } from '../../api/v2/ProximoPasoProvider';

// "Tu próximo paso" en Inicio: UN paso grande (abrir una cuenta que rinda,
// hacer la primera inversión) que queda hasta que la persona marca que lo hizo.
// Es la tarjeta elevada de Inicio: lo que más hace avanzar su situación.
//
// Por qué le toca va escrito con sus datos; cómo se hace se abre si lo pide,
// para no llenar Inicio de texto. "Ya lo hice" es a mano porque estos pasos
// pasan afuera de la app; si se tocó sin querer, se deshace ahí mismo.

const CARD_ELEVADA: React.CSSProperties = { background: COLORS.surface, boxShadow: '0 2px 8px rgba(43,33,24,0.08)' };

export function ProximoPasoInicio() {
  const navigate = useNavigate();
  const { paso, listo, hechos, marcarHecho, deshacer } = useProximoPaso();
  const [comoAbierto, setComoAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El último que marcó, para poder deshacerlo y para festejarlo con su nombre.
  const [recien, setRecien] = useState<{ clave: string; titulo: string } | null>(null);

  if (!listo) {
    // Skeleton con la forma del contenido real (§10), no un spinner.
    return <div className="rounded-2xl h-[132px]" style={{ background: COLORS.tint }} aria-label="Cargando tu próximo paso" />;
  }

  async function hecho() {
    if (!paso) return;
    setError(null);
    const titulo = paso.titulo;
    const clave = paso.clave;
    const e = await marcarHecho(clave);
    if (e !== null) { setError('No pudimos guardarlo. Probá de nuevo.'); return; }
    setComoAbierto(false);
    setRecien({ clave, titulo });
  }

  async function volverAtras() {
    if (!recien) return;
    const e = await deshacer(recien.clave);
    if (e !== null) { setError('No pudimos deshacerlo. Probá de nuevo.'); return; }
    setRecien(null);
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Tu próximo paso">
      {/* Lo que acaba de hacer, en lima: es el momento de valor (§3.3, §5.3). */}
      {recien && (
        <div className="flex items-center gap-2 text-[14px]" role="status">
          <p className="flex-1 min-w-0 font-semibold" style={{ color: COLORS.limaText }}>
            Hiciste "{recien.titulo}". {hechos.hechos} de {hechos.total} pasos grandes.
          </p>
          <button type="button" onClick={() => void volverAtras()} className="v2-focus shrink-0 min-h-[44px] px-1 text-[14px] font-semibold underline" style={{ color: COLORS.inkSoft }}>
            Deshacer
          </button>
        </div>
      )}

      <div className="rounded-2xl px-4 py-4 flex flex-col gap-3" style={CARD_ELEVADA}>
        {!paso ? (
          <>
            <p className="text-[14px] font-semibold" style={{ color: COLORS.limaText }}>Tu próximo paso</p>
            <p className="font-bold text-[18px] leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
              Hiciste todos los pasos grandes que te tocaban
            </p>
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>
              Cuando cambie tu situación, acá aparece el siguiente.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Tu próximo paso</p>
              <span className="text-[13px] font-mono tabular-nums" style={{ color: COLORS.inkFaint }}>{hechos.hechos} de {hechos.total}</span>
            </div>
            <p className="font-bold text-[18px] leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{paso.titulo}</p>
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{paso.porQue}</p>

            <button
              type="button"
              aria-expanded={comoAbierto}
              onClick={() => setComoAbierto((v) => !v)}
              className="v2-focus self-start inline-flex items-center gap-1 min-h-[44px] text-[14px] font-semibold"
              style={{ color: COLORS.brand }}
            >
              Cómo hacerlo
              <IconChevron size={14} style={{ transform: comoAbierto ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 120ms' }} />
            </button>
            {comoAbierto && (
              <ol className="flex flex-col gap-2 -mt-1">
                {paso.comoHacerlo.map((t, i) => (
                  <li key={t} className="flex gap-2.5 items-start text-[14px] leading-snug" style={{ color: COLORS.ink }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold" style={{ background: COLORS.tint, color: COLORS.ink }}>{i + 1}</span>
                    <span className="flex-1 pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
            )}

            {error && <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>{error}</p>}

            {/* Si una parte se hace en la app, ese es el botón principal y
                "Ya lo hice" queda al lado. Si todo pasa afuera, "Ya lo hice" es
                el único. El CTA va en lima con texto en tinta (§3.3). */}
            <div className="flex gap-2">
              {paso.enLaApp && (
                <button
                  type="button"
                  onClick={() => navigate(paso.enLaApp!.destino, { state: { abrir: paso.enLaApp!.abrir, from: '/onboarding-v2/home' } })}
                  className="v2-focus flex-[2] rounded-2xl min-h-[48px] px-3 text-[15px] font-bold transition-transform duration-100 active:scale-[0.99]"
                  style={{ background: COLORS.lima, color: COLORS.ink }}
                >
                  {paso.enLaApp.cta}
                </button>
              )}
              <button
                type="button"
                onClick={() => void hecho()}
                className="v2-focus flex-1 rounded-2xl min-h-[48px] px-3 text-[15px] font-bold transition-transform duration-100 active:scale-[0.99]"
                style={paso.enLaApp
                  ? { color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }
                  : { background: COLORS.lima, color: COLORS.ink }}
              >
                Ya lo hice
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

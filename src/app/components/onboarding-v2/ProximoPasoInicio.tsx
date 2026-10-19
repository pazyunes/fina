import { useState } from 'react';
import { useNavigate } from 'react-router';
import { COLORS, FONTS } from './shared';
import { IconChevron } from './FinaIcons';
import { useProximoPaso } from '../../api/v2/ProximoPasoProvider';
import { FestejoPaso } from './FestejoPaso';

// "Tu próximo paso" en Inicio: UN paso grande (abrir una cuenta que rinda,
// hacer la primera inversión) que queda hasta que la persona lo marca como
// completado. Es la tarjeta elevada de Inicio: lo que más hace avanzar su
// situación.
//
// Cerrada es sólo "Tu próximo paso", el título y "Cómo hacerlo": prioridad al
// celular. Tocar el título despliega por qué le toca y el link a Tu progreso
// (los que ya hizo y los que vienen). Arriba
// a la derecha hay un casillero vacío para marcarlo completado, porque estos
// pasos pasan afuera de la app y FINA no los ve; al marcarlo se festeja con confeti, y si fue sin
// querer se deshace ahí mismo. Cómo se hace se abre si lo pide.

const CARD_ELEVADA: React.CSSProperties = { background: COLORS.surface, boxShadow: '0 2px 8px rgba(43,33,24,0.08)' };
const PROGRESO = '/onboarding-v2/progreso';

export function ProximoPasoInicio() {
  const navigate = useNavigate();
  const { paso, listo, hechos, marcarHecho, deshacer } = useProximoPaso();
  const [comoAbierto, setComoAbierto] = useState(false);
  // Por qué le toca: se abre tocando el título. Cerrado, la tarjeta es sólo
  // el título y entra entera en el celular.
  const [porQueAbierto, setPorQueAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [festejando, setFestejando] = useState(false);
  // El círculo se llena apenas se toca; el festejo sale un instante después,
  // para que se vea el tilde.
  const [llenando, setLlenando] = useState(false);
  // El último que marcó: para festejarlo con su nombre y poder deshacerlo.
  const [recien, setRecien] = useState<{ clave: string; titulo: string } | null>(null);

  if (!listo) {
    // Skeleton con la forma del contenido real (§10), no un spinner.
    return <div className="rounded-2xl h-[132px]" style={{ background: COLORS.tint }} aria-label="Cargando tu próximo paso" />;
  }

  async function completar() {
    if (!paso) return;
    setError(null);
    const titulo = paso.titulo;
    const clave = paso.clave;
    // El festejo sale en el acto, como el paso marcado. Si la base no lo
    // guarda, se cierra y se avisa.
    setLlenando(true);
    await new Promise((r) => window.setTimeout(r, 450));
    setRecien({ clave, titulo });
    setFestejando(true);
    setComoAbierto(false);
    const e = await marcarHecho(clave);
    setLlenando(false);
    if (e !== null) { setFestejando(false); setRecien(null); setError('No pudimos guardarlo. Probá de nuevo.'); }
  }

  async function volverAtras() {
    if (!recien) return;
    const e = await deshacer(recien.clave);
    if (e !== null) { setError('No pudimos deshacerlo. Probá de nuevo.'); return; }
    setRecien(null);
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Tu próximo paso">
      {festejando && recien && (
        <FestejoPaso
          titulo={recien.titulo}
          hechos={hechos.hechos}
          total={hechos.total}
          onVerProgreso={() => { setFestejando(false); navigate(PROGRESO); }}
          onCerrar={() => setFestejando(false)}
        />
      )}

      {/* Lo que acaba de hacer, en lima: el momento de valor (§3.3, §5.3). */}
      {recien && !festejando && (
        <div className="flex items-center gap-2 text-[14px]" role="status">
          <p className="flex-1 min-w-0 font-semibold" style={{ color: COLORS.limaText }}>
            Completaste "{recien.titulo}".
          </p>
          <button type="button" onClick={() => void volverAtras()} className="v2-focus shrink-0 min-h-[44px] px-1 text-[14px] font-semibold underline" style={{ color: COLORS.inkSoft }}>
            Deshacer
          </button>
        </div>
      )}

      <div className="rounded-2xl px-4 py-3 flex flex-col gap-2.5" style={CARD_ELEVADA}>
        {!paso ? (
          <button type="button" onClick={() => navigate(PROGRESO)} className="v2-focus text-left flex flex-col gap-1.5 rounded-xl">
            <span className="text-[14px] font-semibold" style={{ color: COLORS.limaText }}>Tu próximo paso</span>
            <span className="font-bold text-[18px] leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
              Completaste todos los pasos grandes que te tocaban
            </span>
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: COLORS.brand }}>
              Ver tu progreso <IconChevron size={14} />
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold pt-2.5" style={{ color: COLORS.inkSoft }}>Tu próximo paso</p>
              {/* Un casillero vacío: se toca y se llena con el tilde. El área
                  táctil es de 44px aunque el círculo se vea de 30. */}
              <button
                type="button"
                onClick={() => void completar()}
                disabled={llenando}
                aria-label={`Marcar "${paso.titulo}" como completado`}
                aria-pressed={llenando}
                className="v2-focus shrink-0 w-11 h-11 -mr-1.5 -mt-1 rounded-full flex items-center justify-center"
              >
                <span
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-200"
                  style={llenando
                    ? { background: COLORS.lima, color: COLORS.ink, border: `2px solid ${COLORS.lima}`, transform: 'scale(1.12)' }
                    : { border: `2px solid ${COLORS.lineStrong}`, color: 'transparent' }}
                  aria-hidden
                >
                  <svg width={13} height={10} viewBox="0 0 14 11" fill="none"><path d="M1 5.5L5 9.5L13 1.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </button>
            </div>

            {/* El título se toca: despliega por qué le toca (con sus datos,
                por ejemplo la plata que tiene apartada) y el link a Tu progreso. */}
            <button
              type="button"
              aria-expanded={porQueAbierto}
              onClick={() => setPorQueAbierto((v) => !v)}
              className="v2-focus text-left flex items-start gap-2 rounded-xl -mt-2"
            >
              <span className="flex-1 font-bold text-[18px] leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{paso.titulo}</span>
              <span className="shrink-0 pt-0.5" style={{ color: COLORS.inkFaint }} aria-hidden>
                <IconChevron size={18} style={{ transform: porQueAbierto ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 120ms' }} />
              </span>
            </button>
            {porQueAbierto && (
              <div className="flex flex-col gap-1 -mt-1">
                <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{paso.porQue}</p>
                <button type="button" onClick={() => navigate(PROGRESO)} className="v2-focus self-start inline-flex items-center gap-1 min-h-[44px] text-[14px] font-semibold" style={{ color: COLORS.brand }}>
                  Ver tu progreso <IconChevron size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              aria-expanded={comoAbierto}
              onClick={() => setComoAbierto((v) => !v)}
              className="v2-focus self-start inline-flex items-center gap-1 min-h-[44px] -my-1.5 text-[14px] font-semibold"
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

            {/* Si una parte se hace en la app, el botón lleva ahí. En lima con
                texto en tinta (§3.3). */}
            {/* Si una parte se hace en la app, el botón aparece con Cómo
                hacerlo abierto: cerrado, la tarjeta queda sólo con el título. */}
            {comoAbierto && paso.enLaApp && (
              <button
                type="button"
                onClick={() => navigate(paso.enLaApp?.destino ?? PROGRESO, { state: { abrir: paso.enLaApp?.abrir, from: '/onboarding-v2/home' } })}
                className="v2-focus w-full rounded-2xl min-h-[48px] px-3 text-[15px] font-bold transition-transform duration-100 active:scale-[0.99]"
                style={{ background: COLORS.lima, color: COLORS.ink }}
              >
                {paso.enLaApp.cta}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

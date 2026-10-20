import { useEffect, useState } from 'react';
import { diaArgentina } from '../../api/v2/pasos';
import { COLORS, FONTS } from './shared';
import { preguntaDelDia } from './preguntasDelDia';

// La pregunta del día (DEBT R1): algo para hacer en la app cuando no hay nada
// pendiente. Una pregunta corta de finanzas con contexto argentino, una por
// día. Al contestar se ve si era esa y por qué. No toca la racha: es para
// aprender, no para sumar.
//
// Va debajo de la recomendación y en segundo plano: sin tarjeta, sin color de
// acento en el título. Lo principal de Home sigue siendo el paso de hoy.
//
// Lo contestado se guarda en este navegador (por día), con un contador de
// cuántas acertó. Si el almacenamiento no anda, la pregunta funciona igual y
// sólo se pierde el recuerdo.

type Respuesta = { id: string; elegida: number; acerto: boolean };
type Guardado = Record<string, Respuesta>;

const CLAVE = 'fina:pregunta-del-dia';

function leer(): Guardado {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const v: unknown = crudo ? JSON.parse(crudo) : null;
    return v && typeof v === 'object' ? (v as Guardado) : {};
  } catch {
    return {};
  }
}

function guardar(g: Guardado) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // Sin almacenamiento: la respuesta queda en pantalla hasta recargar.
  }
}

// ── Entrada en Inicio ────────────────────────────────────────────────────
// La pregunta es opcional y no vive suelta en Inicio (que es un tablero de
// entradas): es un botoncito pegado al paso del día que abre un panel desde
// abajo. La primera vez que se entra en el día, si todavía no se contestó, el
// panel se abre solo una vez, con "Ahora no" para cerrarlo.
const CLAVE_VISTA = 'fina:pregunta-del-dia-vista';

function yaSeOfrecioHoy(dia: string): boolean {
  try { return window.localStorage.getItem(CLAVE_VISTA) === dia; } catch { return true; }
}
function marcarOfrecida(dia: string) {
  try { window.localStorage.setItem(CLAVE_VISTA, dia); } catch { /* sin almacenamiento: no se vuelve a ofrecer sola en esta visita */ }
}

export function EntradaPreguntaDelDia() {
  const [dia] = useState(() => diaArgentina());
  const p = preguntaDelDia(dia);
  const [abierta, setAbierta] = useState(false);
  const [respondida, setRespondida] = useState(() => leer()[dia]?.id === p.id);

  useEffect(() => {
    if (respondida || yaSeOfrecioHoy(dia)) return;
    marcarOfrecida(dia);
    // Un respiro para que primero se vea la pantalla y después el panel.
    const t = window.setTimeout(() => setAbierta(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="v2-focus self-start min-h-[44px] px-4 rounded-full text-[13px] font-semibold flex items-center gap-2"
        style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.line}` }}
      >
        Pregunta del día
        <span className="text-[13px] font-medium" style={{ color: respondida ? COLORS.limaText : COLORS.inkSoft }}>
          {respondida ? 'respondida' : '1 minuto'}
        </span>
      </button>
      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="pregunta-del-dia">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 cursor-default" style={{ background: 'rgba(43,33,24,0.45)' }} onClick={() => setAbierta(false)} />
          <div
            className="relative w-full max-w-lg rounded-t-3xl px-5 pt-5 flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
            style={{ background: COLORS.paper, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
          >
            <PreguntaDelDia onRespondida={() => setRespondida(true)} />
            <button
              type="button"
              autoFocus
              onClick={() => setAbierta(false)}
              className="v2-focus w-full min-h-[44px] rounded-xl text-[13px] font-semibold"
              style={{ color: COLORS.inkSoft }}
            >
              {respondida ? 'Cerrar' : 'Ahora no'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function PreguntaDelDia({ onRespondida }: { onRespondida?: () => void } = {}) {
  const [dia] = useState(() => diaArgentina());
  const p = preguntaDelDia(dia);
  const [guardado, setGuardado] = useState<Guardado>(() => leer());
  const hoy = guardado[dia]?.id === p.id ? guardado[dia] : null;

  const respuestas = Object.values(guardado).filter((r) => r && typeof r.acerto === 'boolean');
  const acertadas = respuestas.filter((r) => r.acerto).length;

  function responder(i: number) {
    if (hoy) return;
    const nuevo = { ...guardado, [dia]: { id: p.id, elegida: i, acerto: i === p.correcta } };
    setGuardado(nuevo);
    guardar(nuevo);
    onRespondida?.();
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pregunta-del-dia">
      <h2 id="pregunta-del-dia" className="text-[14px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
        Pregunta del día
      </h2>
      <p className="text-[13px] leading-snug" style={{ color: COLORS.ink }}>{p.pregunta}</p>

      <div className="flex flex-col gap-2" role="group" aria-label="Opciones">
        {p.opciones.map((o, i) => {
          const esCorrecta = i === p.correcta;
          const laEligio = hoy?.elegida === i;
          // Contestada: la correcta en lima (es un acierto que se muestra),
          // la que eligió si no era, en hueco. Nunca en color de alerta.
          const estilo = !hoy
            ? { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }
            : esCorrecta
              ? { background: COLORS.limaSoft, color: COLORS.ink, border: `1.5px solid ${COLORS.limaViz}` }
              : laEligio
                ? { background: COLORS.tint, color: COLORS.ink, border: `1.5px solid ${COLORS.line}` }
                : { background: 'transparent', color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` };
          return (
            <button
              key={o}
              type="button"
              onClick={() => responder(i)}
              disabled={!!hoy}
              aria-pressed={laEligio}
              className="v2-focus w-full min-h-[44px] px-4 py-2.5 rounded-xl text-left text-[13px] font-medium flex items-center justify-between gap-3"
              style={estilo}
            >
              <span>{o}</span>
              {hoy && esCorrecta && <span className="shrink-0 text-[13px] font-semibold" style={{ color: COLORS.limaText }}>Correcta</span>}
              {hoy && laEligio && !esCorrecta && <span className="shrink-0 text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>Tu respuesta</span>}
            </button>
          );
        })}
      </div>

      {hoy && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>
            <span className="font-semibold" style={{ color: COLORS.ink }}>{hoy.acerto ? 'Bien, es esa. ' : 'Era otra. '}</span>
            {p.explicacion}
          </p>
          <p className="text-[13px] font-mono tabular-nums" style={{ color: COLORS.inkFaint }}>
            Acertaste {acertadas} de {respuestas.length}. Mañana hay otra.
          </p>
        </div>
      )}
    </section>
  );
}

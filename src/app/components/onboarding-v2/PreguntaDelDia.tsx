import { useState } from 'react';
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

export function PreguntaDelDia() {
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
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pregunta-del-dia">
      <h2 id="pregunta-del-dia" className="text-[17px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
        Pregunta del día
      </h2>
      <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>{p.pregunta}</p>

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
              className="v2-focus w-full min-h-[44px] px-4 py-2.5 rounded-xl text-left text-[15px] font-medium flex items-center justify-between gap-3"
              style={estilo}
            >
              <span>{o}</span>
              {hoy && esCorrecta && <span className="shrink-0 text-[14px] font-semibold" style={{ color: COLORS.limaText }}>Correcta</span>}
              {hoy && laEligio && !esCorrecta && <span className="shrink-0 text-[14px] font-semibold" style={{ color: COLORS.inkSoft }}>Tu respuesta</span>}
            </button>
          );
        })}
      </div>

      {hoy && (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>
            <span className="font-semibold" style={{ color: COLORS.ink }}>{hoy.acerto ? 'Bien, es esa. ' : 'Era otra. '}</span>
            {p.explicacion}
          </p>
          <p className="text-[14px] font-mono tabular-nums" style={{ color: COLORS.inkFaint }}>
            Acertaste {acertadas} de {respuestas.length}. Mañana hay otra.
          </p>
        </div>
      )}
    </section>
  );
}

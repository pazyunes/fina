import { useEffect, useId, useState } from 'react';
import './fini.css';

// PRUEBA — Fini animada. Port directo del prototipo en Svelte (Fini.svelte):
// mismo SVG, mismo CSS, mismos nombres de clase. Lo único que cambia es el
// armado del componente (props de React, useId para el gradiente, onAnimationEnd
// en vez de on:animationend).
//
// Esta rama es descartable: `git checkout dev` y no queda nada.
//
// OJO con dos estados, que el prototipo trae pero la guía no habilita (§6):
//   · 'alerta' está descrito como "atención / gasto inesperado". La guía dice
//     literalmente que Fini no reacciona a un gasto y que no hay Fini
//     preocupada, porque eso es moralizar con otra cara. Se deja disponible
//     para verlo en el playground, pero NO se cablea a ningún gasto.
//   · 'error' hace que Fini se tropiece. Un personaje tropezándose al lado de
//     una falla hace que la app parezca torpe justo cuando necesita confianza.
// Ver la discusión en el playground.
export type FiniState =
  | 'idle' | 'saludo' | 'registro' | 'pensando' | 'insight'
  | 'progreso' | 'logro' | 'alerta' | 'vacio' | 'error' | 'cierre';

export function Fini({
  state = 'idle',
  size = 150,
  once = false,
  speed = 1,
  label = 'Fini',
  onDone,
}: {
  state?: FiniState;
  /** número (px) o cualquier unidad CSS: 52, "3rem", "100%" */
  size?: number | string;
  /** true = se reproduce una sola vez y dispara onDone */
  once?: boolean;
  /** multiplicador de duración: 1 normal, 1.6 lento, 0.7 rápido */
  speed?: number;
  label?: string;
  onDone?: (state: FiniState) => void;
}) {
  const uid = `finiGrad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [ended, setEnded] = useState(false);

  // Al cambiar de estado se vuelve a habilitar el disparo de onDone, igual que
  // el `$: state, (ended = false)` del original.
  useEffect(() => { setEnded(false); }, [state]);

  function onAnimationEnd() {
    if (once && !ended) {
      setEnded(true);
      onDone?.(state);
    }
  }

  return (
    <svg
      style={{
        // Se pasan como CSS vars, que es lo que consume fini.css.
        ['--fini-size' as string]: typeof size === 'number' ? `${size}px` : size,
        ['--fini-sp' as string]: String(speed),
        ['--fini-iter' as string]: once ? '1' : 'infinite',
      }}
      onAnimationEnd={onAnimationEnd}
      className={`fini-svg fini-st-${state}`}
      viewBox="-190 -180 380 350"
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id={uid} cx="50%" cy="46%" r="66%">
          <stop offset="0%" stopColor="#FFD84E" />
          <stop offset="30%" stopColor="#FFC534" />
          <stop offset="58%" stopColor="#FBA23E" />
          <stop offset="82%" stopColor="#F97C55" />
          <stop offset="100%" stopColor="#FA5A78" />
        </radialGradient>
      </defs>
      <g className="fini-root">
        <g className="fini-props">
          <g className="fini-prop-dots">
            <circle cx="46" cy="-118" r="6" fill="#D22C93" />
            <circle cx="74" cy="-137" r="8" fill="#D22C93" />
            <circle cx="106" cy="-155" r="10" fill="#D22C93" />
          </g>
          <g className="fini-prop-bulb">
            <path d="M 112 -60 l 0 -12" stroke="#2F1560" strokeWidth="7" strokeLinecap="round" />
            <path d="M 100 -66 h 24" stroke="#8E44AD" strokeWidth="9" strokeLinecap="round" />
            <circle cx="112" cy="-104" r="27" fill="#FFD84E" stroke="#2F1560" strokeWidth="7" />
            <path d="M 106 -104 q 6 -10 12 0" fill="none" stroke="#2F1560" strokeWidth="5" strokeLinecap="round" />
            <g stroke="#2F1560" strokeWidth="6" strokeLinecap="round">
              <path d="M 112 -142 v 12" /><path d="M 84 -132 l 8 8" /><path d="M 140 -132 l -8 8" />
              <path d="M 72 -104 h 11" /><path d="M 152 -104 h -11" />
            </g>
          </g>
          <g className="fini-prop-spark" fill="#D22C93">
            <circle cx="-84" cy="-96" r="9" />
            <circle cx="-42" cy="-124" r="7" />
            <circle cx="6" cy="-138" r="9" />
            <circle cx="52" cy="-122" r="7" />
            <circle cx="92" cy="-92" r="9" />
          </g>
          <circle className="fini-prop-ring" cx="140" cy="-72" r="17" fill="none" stroke="#D22C93" strokeWidth="7" />
          <path className="fini-prop-check" d="M 118 -66 l 13 14 l 26 -32" fill="none" stroke="#2ED3C0" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="fini-arm fini-arm-l fini-lm"><path d="M -58 4 C -96 16 -120 22 -138 14" fill="none" strokeWidth="9" strokeLinecap="round" /></g>
        <g className="fini-arm fini-arm-r fini-lm"><path d="M 58 4 C 96 16 120 22 138 14" fill="none" strokeWidth="9" strokeLinecap="round" /></g>
        <g className="fini-leg fini-leg-l fini-lm">
          <path d="M -26 62 C -28 92 -28 108 -28 124" fill="none" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="-36" cy="132" rx="17" ry="9.5" fill="none" strokeWidth="9" />
        </g>
        <g className="fini-leg fini-leg-r fini-lm">
          <path d="M 26 62 C 28 92 28 108 28 124" fill="none" strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="36" cy="132" rx="17" ry="9.5" fill="none" strokeWidth="9" />
        </g>
        <g className="fini-body">
          <path
            className="fini-star"
            d="M -8.6 -84.5 Q 0.0 -98.0 8.9 -84.7 L 19.5 -69.0 Q 35.5 -45.2 63.1 -37.9 L 80.5 -33.3 Q 96.8 -29.1 85.0 -17.8 L 71.2 -4.8 Q 50.5 15.2 56.6 45.1 L 61.0 66.2 Q 64.1 81.6 48.5 75.7 L 28.8 68.0 Q 0.0 56.8 -27.2 65.9 L -44.5 71.6 Q -60.4 76.9 -57.7 61.4 L -54.4 42.7 Q -49.4 14.8 -74.3 -6.0 L -92.2 -21.0 Q -104.8 -31.5 -88.2 -34.4 L -66.0 -38.1 Q -34.2 -43.6 -18.9 -68.1 L -8.6 -84.5 Z"
            fill={`url(#${uid})`}
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <g className="fini-face">
            <ellipse className="fini-blush" cx="-48" cy="14" rx="12" ry="8.5" fill="#FF6B77" opacity=".85" />
            <ellipse className="fini-blush" cx="48" cy="14" rx="12" ry="8.5" fill="#FF6B77" opacity=".85" />
            <g className="fini-eyes">
              <rect className="eye fini-ink" x="-31" y="-18" width="14" height="32" rx="7" />
              <rect className="eye fini-ink" x="17" y="-18" width="14" height="32" rx="7" />
            </g>
            <path className="fini-mouth fini-ink-s" d="M -15 26 Q 0 40 15 26" fill="none" strokeWidth="6.5" strokeLinecap="round" />
            <path className="fini-mouth-open fini-ink" d="M -17 22 Q 0 26 17 22 Q 17 50 0 50 Q -17 50 -17 22 Z" />
            <g className="fini-brows fini-ink-s" fill="none" strokeWidth="6" strokeLinecap="round">
              <path d="M -34 -32 Q -24 -41 -14 -33" />
              <path d="M 14 -33 Q 24 -41 34 -32" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

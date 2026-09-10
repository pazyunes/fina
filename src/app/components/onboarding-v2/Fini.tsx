import { useEffect, useState } from 'react';
import './fini.css';
import armL from './fini-parts/arm-l.png';
import armR from './fini-parts/arm-r.png';
import legL from './fini-parts/leg-l.png';
import legR from './fini-parts/leg-r.png';
import body from './fini-parts/body.png';
import mouth from './fini-parts/mouth.png';
import mouthOpen from './fini-parts/mouth-open.png';
import eyeL from './fini-parts/eye-l.png';
import eyeR from './fini-parts/eye-r.png';
import eyeHappyL from './fini-parts/eye-happy-l.png';
import eyeHappyR from './fini-parts/eye-happy-r.png';
import bulb from './fini-parts/bulb.png';
import spark0 from './fini-parts/spark-0.png';
import spark1 from './fini-parts/spark-1.png';
import spark2 from './fini-parts/spark-2.png';
import spark3 from './fini-parts/spark-3.png';
import spark4 from './fini-parts/spark-4.png';
import spark5 from './fini-parts/spark-5.png';

// PRUEBA — Fini animada, versión de capas PNG. Port del paquete `fini-sprite`
// (Fini.svelte + fini.css), que reemplaza al vectorizado anterior: acá no hay
// nada redibujado, son recortes del arte original.
//
// Los 18 PNG se extrajeron del HTML de referencia, donde venían embebidos en
// base64, y viven en ./fini-parts. Se importan para que Vite los procese y les
// ponga hash, igual que hacía el original con sus imports.
//
// Rama descartable: `git checkout dev`.
export type FiniState =
  | 'idle' | 'saludo' | 'registro' | 'pensando' | 'insight'
  | 'progreso' | 'logro' | 'alerta' | 'vacio' | 'error' | 'cierre';

// Estados que son un evento y no un fondo: se disparan una vez y vuelven a
// idle. Lo dice el propio paquete, y es lo que evita que Fini quede saltando
// en loop al costado de algo que ya pasó.
export const FINI_UNA_PASADA: FiniState[] = ['registro', 'insight', 'logro', 'progreso', 'error'];

// El orden acá ES el orden de apilado: primero extremidades, después el torso
// (que tapa los hombros), y arriba los props.
const EXTREMIDADES = [
  ['p-arm-l', armL], ['p-arm-r', armR], ['p-leg-l', legL], ['p-leg-r', legR],
] as const;
const TORSO = [
  ['p-body', body], ['p-mouth', mouth], ['p-mouth-open', mouthOpen],
  ['p-eye-l', eyeL], ['p-eye-r', eyeR], ['p-eye-happy-l', eyeHappyL], ['p-eye-happy-r', eyeHappyR],
] as const;
const PROPS = [
  ['p-bulb', bulb],
  ['p-spark-0', spark0], ['p-spark-1', spark1], ['p-spark-2', spark2],
  ['p-spark-3', spark3], ['p-spark-4', spark4], ['p-spark-5', spark5],
] as const;

function Capa({ clase, src }: { clase: string; src: string }) {
  return <div className={`pt ${clase}`} style={{ backgroundImage: `url(${src})` }} />;
}

export function Fini({
  state = 'idle',
  size = 150,
  once = false,
  speed = 1,
  label = 'Fini',
  onDone,
  className = '',
}: {
  state?: FiniState;
  /** número (px) o cualquier unidad CSS: 52, "3rem", "100%" */
  size?: number | string;
  /** true = una sola pasada, después dispara onDone */
  once?: boolean;
  /** multiplicador de duración: 1 normal, 1.6 lento, 0.7 rápido */
  speed?: number;
  label?: string;
  onDone?: (state: FiniState) => void;
  className?: string;
}) {
  const [ended, setEnded] = useState(false);
  useEffect(() => { setEnded(false); }, [state]);

  function onAnimationEnd() {
    if (once && !ended) {
      setEnded(true);
      onDone?.(state);
    }
  }

  return (
    <div
      className={`fini fini-st-${state} ${className}`}
      role="img"
      aria-label={label}
      style={{
        ['--fini-size' as string]: typeof size === 'number' ? `${size}px` : size,
        ['--fini-sp' as string]: String(speed),
        ['--fini-iter' as string]: once ? '1' : 'infinite',
      }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="fini-root">
        {EXTREMIDADES.map(([clase, src]) => <Capa key={clase} clase={clase} src={src} />)}
        <div className="fini-torso">
          {TORSO.map(([clase, src]) => <Capa key={clase} clase={clase} src={src} />)}
        </div>
        <div className="fini-props">
          {PROPS.map(([clase, src]) => <Capa key={clase} clase={clase} src={src} />)}
        </div>
      </div>
    </div>
  );
}

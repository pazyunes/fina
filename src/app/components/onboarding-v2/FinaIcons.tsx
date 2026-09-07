// FINA · set de íconos de línea propios ("Trazo Fini", primer set).
// Reglas de diseño: SVG con trazo 1.9px, esquinas redondeadas, un solo color
// vía `currentColor` (el color lo pone el contenedor). Reemplazan a los emojis.
// Cuando llegue el set final desde Claude Design, se cambian acá y listo.
import type { CSSProperties } from 'react';

type IconProps = { size?: number; className?: string; style?: CSSProperties };

function Svg({ size = 24, className, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

// Gastos — billete
export function IconGastos(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6 9.6h.01M18 14.4h.01" />
    </Svg>
  );
}

// Objetivos — diana
export function IconObjetivos(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Inversiones — crecimiento (línea que sube con flecha)
export function IconInversiones(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 15.5 9 10.5l3.2 3.2L20 6" />
      <path d="M15.5 6H20v4.5" />
    </Svg>
  );
}

// Reserva — candado / alcancía
export function IconReserva(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14v2.5" />
    </Svg>
  );
}

// Sparkle — "tu próximo paso" / IA
export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3c.6 3.6 1.8 4.8 5.4 5.4C13.8 9 12.6 10.2 12 13.8 11.4 10.2 10.2 9 6.6 8.4 10.2 7.8 11.4 6.6 12 3Z" />
      <path d="M18.5 14.5c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4Z" />
    </Svg>
  );
}

// Perfil / editar — lápiz
export function IconEditar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5.5 18.5 9.5 8 20l-4.2.7L4.5 16.5 14.5 5.5Z" />
      <path d="M13 7 17 11" />
    </Svg>
  );
}

// Grupos / competencia — trofeo
export function IconTrofeo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1.5A3 3 0 0 0 7 10M17 6h3v1.5A3 3 0 0 1 17 10" />
      <path d="M12 13v3M9 20h6M10 20l.5-4h3l.5 4" />
    </Svg>
  );
}

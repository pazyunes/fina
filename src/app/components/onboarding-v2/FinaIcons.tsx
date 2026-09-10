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

// Chevron — afordancia de navegación (reemplaza al "→" de plantilla, §2).
export function IconChevron(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

// Cerrar — X monolineal (reemplaza el glifo ✕, §2). Va con aria-label en el botón.
export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

// Home — techo + base (para el menú, reemplaza el ícono de librería).
export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
      <path d="M10 20v-5h4v5" />
    </Svg>
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

// Sumar / agregar — más
export function IconMas(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

// Borrar — tacho
export function IconBasura(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7 7.3 19a1.7 1.7 0 0 0 1.7 1.6h6a1.7 1.7 0 0 0 1.7-1.6L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

// Chat / WhatsApp — globo
export function IconChat(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12a7.5 7.5 0 1 1 3.5 6.3L4 19.5l1.2-3.4A7.4 7.4 0 0 1 4 12Z" />
      <path d="M9 11h6M9 14h4" />
    </Svg>
  );
}

// Buscar — lupa
export function IconLupa(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Svg>
  );
}

// Racha — llama
export function IconFuego(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1.5-.3-2 2 1.3 3.3 3.3 3.3 5.6a5 5 0 0 1-10 0c0-3 2.5-4.5 3-7 .2-1 1-2.5 2-3.6Z" />
    </Svg>
  );
}

// Grupo — dos personas
export function IconGrupo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-3-4.9" />
    </Svg>
  );
}

// Calendario
// Balanza — "necesario vs impulso": dos platos comparándose. Faltaba en el
// set y era el único de las visualizaciones sin ícono propio.
export function IconBalanza(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5v15M8 19.5h8" />
      <path d="M4 8h16" />
      <path d="M4 8l-2.2 4.2a3.1 3.1 0 0 0 4.4 0Z" />
      <path d="M20 8l2.2 4.2a3.1 3.1 0 0 1-4.4 0Z" />
      <circle cx="12" cy="5.6" r="1.4" />
    </Svg>
  );
}

export function IconCalendario(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </Svg>
  );
}

// Idea — bombita
export function IconIdea(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 17h6M10 20h4" />
      <path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.4-.9 1-.9 1.7H9.3c0-.7-.3-1.3-.9-1.7A6 6 0 0 1 12 3Z" />
    </Svg>
  );
}

// Perfil — persona
export function IconPerfil(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}

import { useId, useState } from 'react';
import { IconChevron } from '../FinaIcons';
import { COLORS } from '../shared';

// Una sección que se abre y se cierra. Se ve como algo que se toca: título en
// violeta, una flecha que gira, y el área de toque ocupa todo el ancho (≥ 44 px).
// Se hace con un botón (y no con <details>) para que siempre se vea la flecha y
// el estado abierto/cerrado lo lean también los lectores de pantalla.
export function Desplegable({
  titulo, children, abiertoInicial = false, className = '',
}: {
  titulo: string;
  children: React.ReactNode;
  abiertoInicial?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-controls={id}
        className="v2-focus w-full min-h-[48px] flex items-center justify-between gap-3 text-left text-[16px] font-bold transition-colors duration-100"
        style={{ color: COLORS.brand }}
      >
        <span>{titulo}</span>
        <span
          className="shrink-0 transition-transform duration-150"
          style={{ transform: abierto ? 'rotate(90deg)' : 'none' }}
          aria-hidden
        >
          <IconChevron size={18} />
        </span>
      </button>
      {abierto && <div id={id}>{children}</div>}
    </div>
  );
}

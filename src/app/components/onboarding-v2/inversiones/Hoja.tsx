import { useEffect } from 'react';
import { IconClose } from '../FinaIcons';
import { COLORS, Titulo } from '../shared';

// La hoja que se abre encima de la pantalla (abajo en el teléfono, centrada en
// escritorio). Es el mismo patrón que ya usan Objetivos y el detalle viejo de
// Inversiones; vive acá para no repetirlo en cada pieza nueva.
export function Hoja({
  titulo, onCerrar, children, ancho = 420,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center sm:p-5"
      style={{ background: `${COLORS.ink}73` }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] p-6 flex flex-col gap-5"
        style={{ background: COLORS.surface, maxWidth: ancho }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <Titulo className="!text-[26px]">{titulo}</Titulo>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="v2-focus w-11 h-11 -mr-2 -mt-1 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={{ color: COLORS.inkSoft }}
          >
            <IconClose size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Un dato con su etiqueta, en cifras tabulares. */
export function DatoFila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <span className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{etiqueta}</span>
      <span className="font-mono tabular-nums text-[14px] font-semibold text-right" style={{ color: COLORS.ink }}>{valor}</span>
    </div>
  );
}

/** Párrafo de lectura (< 70 caracteres de ancho, guía §3.4). */
export function Parrafo({ children, suave = true }: { children: React.ReactNode; suave?: boolean }) {
  return (
    <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: suave ? COLORS.inkSoft : COLORS.ink }}>
      {children}
    </p>
  );
}

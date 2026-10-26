import { useEffect } from 'react';
import { IconChevron, IconClose } from '../FinaIcons';
import { COLORS } from '../shared';

// La hoja que se abre encima de la pantalla (abajo en el teléfono, centrada en escritorio). El encabezado
// (flecha para volver, título y cerrar) queda FIJO arriba: lo que cambia es el contenido de abajo. Todo el
// contenido se achica de forma pareja (`compacta`) para que una pantalla entre sin tener que deslizar.
export function Hoja({
  titulo, subtitulo, onCerrar, children, ancho = 420, onVolver, arriba, compacta = true,
}: {
  titulo: string;
  /** Una segunda línea más chica debajo del título (por ejemplo, el nombre de la inversión). */
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number;
  /** Si está, aparece una flechita para volver, arriba a la izquierda. */
  onVolver?: () => void;
  /** Algo a la derecha del título (por ejemplo "Siguiente"). */
  arriba?: React.ReactNode;
  /** Achica todo el contenido por igual (los títulos también), para que entre en una pantalla. */
  compacta?: boolean;
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
        className="w-full max-h-[94vh] min-h-[52vh] flex flex-col rounded-t-[24px] sm:rounded-[24px] overflow-hidden"
        style={{ background: COLORS.surface, maxWidth: ancho }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-3 pt-3 pb-2 shrink-0 border-b" style={{ borderColor: COLORS.line }}>
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              aria-label="Volver"
              className="v2-focus w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
              style={{ color: COLORS.brand }}
            >
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><IconChevron size={20} /></span>
            </button>
          )}
          <div className="flex-1 min-w-0 pl-2 flex flex-col">
            <h2 className="text-[17px] font-bold leading-tight" style={{ color: COLORS.ink }}>{titulo}</h2>
            {subtitulo && <p className="text-[13px] leading-tight" style={{ color: COLORS.inkSoft }}>{subtitulo}</p>}
          </div>
          {arriba}
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="v2-focus w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 active:scale-90"
            style={{ color: COLORS.inkSoft }}
          >
            <IconClose size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 flex flex-col gap-3.5" style={compacta ? { zoom: 0.9 } : undefined}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** El avance: un círculo por cada paso, que se va rellenando, y "2/6" al lado. */
export function ProgresoPasos({ total, hechos, actual }: { total: number; hechos: number; actual?: number }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${hechos} de ${total} pasos hechos`}>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="w-3 h-3 rounded-full"
            style={i < hechos
              ? { background: COLORS.lima, border: `1.5px solid ${COLORS.lima}` }
              : i === actual
                ? { background: COLORS.surface, border: `2px solid ${COLORS.brand}` }
                : { background: COLORS.surface, border: `1.5px solid ${COLORS.lineStrong}` }}
          />
        ))}
      </div>
      <span className="text-[13px] font-semibold font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>{hechos}/{total}</span>
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

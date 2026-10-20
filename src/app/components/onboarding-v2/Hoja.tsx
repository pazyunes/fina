import { useEffect } from 'react';
import { COLORS, FONTS } from './shared';
import { IconClose } from './FinaIcons';

// Una hoja que se abre aparte, encima de la pantalla: en el celular sube desde
// abajo y en la compu queda centrada. Para formularios que no tienen que
// mezclarse con lo que hay detrás (registrar un gasto): el velo de atrás deja
// claro que es otra cosa, y al cerrarla todo queda como estaba.
//
// Se cierra con la X, con Esc o tocando el velo.

export function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(43,33,24,0.45)' }}
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[24px] sm:rounded-[24px] px-5 pt-3 pb-6 flex flex-col gap-1"
        style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* La rayita de arriba avisa que es una hoja, como en el celular. */}
        <span className="sm:hidden self-center w-10 h-1 rounded-full mb-1" style={{ background: COLORS.line }} aria-hidden />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[17px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{titulo}</p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="v2-focus w-11 h-11 -mr-2 rounded-full flex items-center justify-center shrink-0"
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

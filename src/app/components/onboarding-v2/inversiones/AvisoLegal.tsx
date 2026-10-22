import { AVISO_LEGAL } from '../../../lib/inversiones/legal';
import { COLORS } from '../shared';

// El aviso legal de Inversiones: va siempre, en cada pantalla donde se muestra algo que se podría tomar
// como una sugerencia, aunque FINA llegue a estar matriculada.
export function AvisoLegal() {
  return (
    <aside aria-label="Aviso legal" className="flex flex-col gap-1.5 pt-2">
      {AVISO_LEGAL.map((t) => (
        <p key={t} className="text-[13px] leading-snug max-w-[62ch]" style={{ color: COLORS.inkFaint }}>{t}</p>
      ))}
    </aside>
  );
}

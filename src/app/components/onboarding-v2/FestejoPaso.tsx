import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { COLORS, FONTS } from './shared';
import { Fini } from './Fini';

// El festejo al completar un paso grande: confeti que cae por toda la pantalla
// y, en el medio, Fini festejando con el paso que se hizo. Es un logro real
// (la persona hizo algo grande afuera de la app), así que acá sí va el
// festejo grande; §6 deja a Fini en los logros.
//
// Se cierra tocando cualquier lado, con Esc, o con los botones. Quien pidió
// reducir el movimiento ve el cartel sin confeti.

const PIEZAS = 46;

// Pseudoaleatorio fijo por pieza: si cambiara en cada render, el confeti
// saltaría de lugar a mitad de la caída.
function azar(i: number, semilla: number): number {
  const x = Math.sin(i * 12.9898 + semilla * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function FestejoPaso({ titulo, hechos, total, onVerProgreso, onCerrar }: {
  titulo: string;
  hechos: number;
  total: number;
  onVerProgreso: () => void;
  onCerrar: () => void;
}) {
  const reducir = useReducedMotion();
  const colores = [COLORS.lima, COLORS.star, COLORS.brand, COLORS.naranja, COLORS.azul, COLORS.magenta];
  const piezas = useMemo(() => Array.from({ length: PIEZAS }, (_, i) => ({
    id: i,
    x: azar(i, 1) * 100,
    deriva: (azar(i, 2) - 0.5) * 160,
    giro: (azar(i, 3) - 0.5) * 900,
    demora: azar(i, 4) * 0.5,
    duracion: 1.8 + azar(i, 5) * 1.4,
    ancho: 6 + Math.round(azar(i, 6) * 6),
    color: colores[i % colores.length],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 overflow-hidden"
      style={{ background: 'rgba(43,33,24,0.35)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Completaste un paso"
    >
      {!reducir && piezas.map((p) => (
        <motion.span
          key={p.id}
          aria-hidden
          className="absolute top-0 rounded-[2px] pointer-events-none"
          style={{ left: `${p.x}%`, width: p.ancho, height: p.ancho * 1.6, background: p.color }}
          initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', x: p.deriva, rotate: p.giro, opacity: [1, 1, 0.9] }}
          transition={{ duration: p.duracion, delay: p.demora, ease: 'easeIn' }}
        />
      ))}

      <motion.div
        className="relative w-full max-w-[340px] rounded-[24px] px-5 pt-4 pb-5 flex flex-col items-center text-center gap-2"
        style={{ background: COLORS.surface, boxShadow: '0 12px 40px -8px rgba(43,33,24,0.35)' }}
        initial={reducir ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Fini state="logro" size={110} />
        <p className="text-[21px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>¡Lo hiciste!</p>
        <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{titulo}</p>
        <p className="text-[13px] font-semibold tabular-nums" style={{ color: COLORS.limaText }}>
          {hechos} de {total} pasos grandes
        </p>
        <div className="w-full flex flex-col gap-2 pt-2">
          <button
            type="button"
            autoFocus
            onClick={onVerProgreso}
            className="v2-focus w-full rounded-2xl min-h-[48px] text-[14px] font-bold transition-transform active:scale-[0.99]"
            style={{ background: COLORS.lima, color: COLORS.ink }}
          >
            Ver tu progreso
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="v2-focus w-full min-h-[44px] text-[13px] font-semibold"
            style={{ color: COLORS.inkSoft }}
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

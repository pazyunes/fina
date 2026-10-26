import { COLORS, Cta } from '../shared';

// Después de anotar una inversión: un mensaje corto y cálido. Lo difícil es empezar, y ya lo hicieron.
// Sin confeti ni exagerar: reconoce lo que pasó y dice qué viene ahora.
export function Felicitaciones({ nombre, onListo, textoBoton = 'Ver mis inversiones' }: { nombre: string; onListo: () => void; textoBoton?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4" role="status">
      <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: COLORS.lima }} aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <h3 className="text-[22px] font-bold leading-tight" style={{ color: COLORS.ink }}>¡Felicitaciones, ya invertiste!</h3>
      <p className="text-[15px] leading-snug max-w-[34ch]" style={{ color: COLORS.inkSoft }}>
        Anotaste {nombre}. Lo más difícil es dar el primer paso, y ya lo hiciste. Ahora FINA te cuenta cómo va y te avisa cuándo hay que hacer algo.
      </p>
      <div className="w-full pt-1"><Cta label={textoBoton} onClick={onListo} /></div>
    </div>
  );
}

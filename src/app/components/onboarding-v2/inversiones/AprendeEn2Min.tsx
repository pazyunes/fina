import { useState } from 'react';
import type { Producto } from '../../../lib/inversiones/catalogo';
import type { FichaRinde } from '../../../lib/inversiones/rinde';
import type { Confianza } from '../shared';
import { COLORS, Cta } from '../shared';
import { GlobitoAntes, GlobitoCuando, GlobitoDonde, GlobitoGarantia, GlobitoQueEs, GlobitoRiesgo, GlobitoRinde, GlobitoVender, GlosarioNecesario } from './Ficha';
import { Hoja } from './Hoja';

type Pantalla = 'glosario' | 'que-es' | 'rinde' | 'saber' | 'cuando';

// "Aprendé en 2 minutos": lo esencial de una inversión en pantallas cortas, siempre en el mismo orden. La primera es
// el glosario (sólo las palabras difíciles; la inversión misma se explica en "¿Qué es?"). Después: qué es y dónde queda
// tu plata, cuánto rinde y qué riesgo tiene, qué tenés que saber antes de invertir (y cuándo vender), y cuándo la sacás
// y quién la garantiza. El título queda fijo arriba, la flecha vuelve a la pantalla anterior y "Siguiente" va arriba.
// Al final, "¡Empecemos!". Si se vuelve de los pasos, se cae en la última pantalla, no en la primera.
export function AprendeEn2Min({
  producto, ficha, confianza, aviso, alVolverDePasos = false, onEmpezar, onCerrar,
}: {
  producto: Producto;
  ficha: FichaRinde | null;
  confianza: Confianza;
  /** Si lo que eligió no encaja con su plazo, se lo decimos antes de empezar. */
  aviso?: string | null;
  /** true si se llegó volviendo desde los pasos: se arranca en la última pantalla. */
  alVolverDePasos?: boolean;
  onEmpezar: () => void;
  onCerrar: () => void;
}) {
  // Sin palabras técnicas que explicar, no hay pantalla de glosario.
  const pantallas: Pantalla[] = [...(producto.glosario.length > 0 ? ['glosario' as const] : []), 'que-es', 'rinde', 'saber', 'cuando'];
  const [indice, setIndice] = useState(alVolverDePasos ? pantallas.length - 1 : 0);
  const actual = pantallas[indice];
  const ultima = indice === pantallas.length - 1;

  const siguiente = ultima ? null : (
    <button type="button" onClick={() => setIndice(indice + 1)} className="v2-focus min-h-[40px] px-3 text-[14px] font-bold shrink-0" style={{ color: COLORS.brand }}>
      Siguiente ›
    </button>
  );

  return (
    <Hoja
      titulo="Aprendé en 2 minutos"
      subtitulo={producto.nombre}
      onCerrar={onCerrar}
      onVolver={indice > 0 ? () => setIndice(indice - 1) : undefined}
      arriba={siguiente}
    >
      <div className="flex gap-2" role="img" aria-label={`Pantalla ${indice + 1} de ${pantallas.length}`}>
        {pantallas.map((p, i) => (
          <span key={p} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= indice ? COLORS.brand : COLORS.lineStrong }} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {actual === 'glosario' && (
          <p className="text-[14px] leading-snug max-w-[62ch]" style={{ color: COLORS.inkSoft }}>Antes de empezar, estas son las palabras que vas a ver.</p>
        )}
        {actual === 'glosario' && <GlosarioNecesario p={producto} abierto />}
        {actual === 'que-es' && (<><GlobitoQueEs p={producto} /><GlobitoDonde p={producto} /></>)}
        {actual === 'rinde' && (<><GlobitoRinde ficha={ficha} confianza={confianza} /><GlobitoRiesgo p={producto} /></>)}
        {actual === 'saber' && (
          <>
            {aviso && <p role="note" className="text-[14px] leading-snug pl-3 border-l-2 max-w-[62ch]" style={{ color: COLORS.ink, borderColor: COLORS.star }}>{aviso}</p>}
            <GlobitoAntes p={producto} />
            <GlobitoVender p={producto} />
          </>
        )}
        {actual === 'cuando' && (<><GlobitoCuando p={producto} /><GlobitoGarantia p={producto} /></>)}
      </div>

      {ultima && <Cta label="¡Empecemos!" onClick={onEmpezar} />}
    </Hoja>
  );
}

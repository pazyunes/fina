import { useState } from 'react';
import type { Producto } from '../../../lib/inversiones/catalogo';
import type { FichaRinde } from '../../../lib/inversiones/rinde';
import type { Confianza } from '../shared';
import { BotonFantasma, COLORS, Cta } from '../shared';
import { GlobitoCuando, GlobitoDonde, GlobitoGarantia, GlobitoQueEs, GlobitoRiesgo, GlobitoRinde, GlosarioNecesario } from './Ficha';
import { Hoja } from './Hoja';

// "Aprendé en 2 minutos": lo esencial de una inversión en cuatro pantallas cortas,
// siempre en el mismo orden. La primera es el glosario: las palabras que se van a
// usar, antes de usarlas, y no se repite en las demás. Al final, "¡Empecemos!".
export function AprendeEn2Min({
  producto, ficha, confianza, onEmpezar, onCerrar,
}: {
  producto: Producto;
  ficha: FichaRinde | null;
  confianza: Confianza;
  onEmpezar: () => void;
  onCerrar: () => void;
}) {
  const [pantalla, setPantalla] = useState(0);
  // Sin palabras técnicas que explicar, no hay pantalla de glosario.
  const conGlosario = producto.glosario.length > 0;
  const pantallas = conGlosario ? ['glosario', 'que-es', 'rinde', 'cuando'] as const : ['que-es', 'rinde', 'cuando'] as const;
  const actual = pantallas[pantalla];
  const ultima = pantalla === pantallas.length - 1;
  return (
    <Hoja titulo={`Aprendé en 2 minutos: ${producto.nombre}`} onCerrar={onCerrar}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2" role="img" aria-label={`Pantalla ${pantalla + 1} de ${pantallas.length}`}>
          {pantallas.map((_, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= pantalla ? COLORS.brand : COLORS.lineStrong }} />
          ))}
        </div>
        <button type="button" onClick={onEmpezar} className="v2-focus min-h-[44px] px-2 text-[14px] font-semibold" style={{ color: COLORS.inkFaint }}>
          Saltear
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        {actual === 'glosario' && (
          <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
            Antes de empezar, estas son las palabras que vas a ver.
          </p>
        )}
        {actual === 'glosario' && <GlosarioNecesario p={producto} abierto />}
        {actual === 'que-es' && (<><GlobitoQueEs p={producto} /><GlobitoDonde p={producto} /></>)}
        {actual === 'rinde' && (<><GlobitoRinde ficha={ficha} confianza={confianza} /><GlobitoRiesgo p={producto} /></>)}
        {actual === 'cuando' && (<><GlobitoCuando p={producto} /><GlobitoGarantia p={producto} /></>)}
      </div>

      <div className="flex flex-col gap-2">
        <Cta label={ultima ? '¡Empecemos!' : 'Siguiente'} onClick={() => (ultima ? onEmpezar() : setPantalla(pantalla + 1))} />
        {pantalla > 0 && <BotonFantasma label="Atrás" onClick={() => setPantalla(pantalla - 1)} />}
      </div>
    </Hoja>
  );
}

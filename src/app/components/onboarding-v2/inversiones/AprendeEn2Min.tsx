import { useState } from 'react';
import type { Producto } from '../../../lib/inversiones/catalogo';
import type { FichaRinde } from '../../../lib/inversiones/rinde';
import type { Confianza } from '../shared';
import { BotonFantasma, COLORS, Cta } from '../shared';
import { GlobitoCuando, GlobitoDonde, GlobitoGarantia, GlobitoQueEs, GlobitoRiesgo, GlobitoRinde, GlosarioNecesario } from './Ficha';
import { Hoja } from './Hoja';

// "Aprendé en 2 minutos": lo esencial de una inversión en tres pantallas cortas,
// siempre las mismas preguntas en el mismo orden. Arriba de todo va el glosario
// necesario: si en el texto aparece una palabra que no se entiende, se sube y se
// busca. Al final, "¡Empecemos!".
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
  const ultima = pantalla === 2;
  return (
    <Hoja titulo={`Aprendé en 2 minutos: ${producto.nombre}`} onCerrar={onCerrar}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2" role="img" aria-label={`Pantalla ${pantalla + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= pantalla ? COLORS.brand : COLORS.lineStrong }} />
          ))}
        </div>
        <button type="button" onClick={onEmpezar} className="v2-focus min-h-[44px] px-2 text-[14px] font-semibold" style={{ color: COLORS.inkFaint }}>
          Saltear
        </button>
      </div>

      <div className="flex flex-col gap-3.5">
        <GlosarioNecesario p={producto} abierto={pantalla === 0} />
        {pantalla === 0 && (<><GlobitoQueEs p={producto} /><GlobitoDonde p={producto} /></>)}
        {pantalla === 1 && (<><GlobitoRinde ficha={ficha} confianza={confianza} /><GlobitoRiesgo p={producto} /></>)}
        {pantalla === 2 && (<><GlobitoCuando p={producto} /><GlobitoGarantia p={producto} /></>)}
      </div>

      <div className="flex flex-col gap-2">
        <Cta label={ultima ? '¡Empecemos!' : 'Siguiente'} onClick={() => (ultima ? onEmpezar() : setPantalla(pantalla + 1))} />
        {pantalla > 0 && <BotonFantasma label="Atrás" onClick={() => setPantalla(pantalla - 1)} />}
      </div>
    </Hoja>
  );
}

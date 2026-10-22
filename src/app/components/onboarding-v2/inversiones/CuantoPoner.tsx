import type { Colchon, SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { fmtPesos } from '../../../lib/inversiones/formato';
import { COLORS, EstadoConfianza, TituloSeccion } from '../shared';

// "¿Con cuánto empezar?" Sale de lo que a la persona le queda cada mes. Si no se
// sabe, esta sección no aparece: no hace falta contar lo que no sabemos.
export function CuantoPoner({ sugerencia, colchon }: { sugerencia: SugerenciaMonto; colchon: Colchon | null }) {
  if (sugerencia.mensajes.length === 0) return null;
  const falta = colchon && colchon.meta > 0 && !colchon.cubierto ? colchon : null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="cuanto-titulo">
      <div id="cuanto-titulo"><TituloSeccion>¿Con cuánto empezar?</TituloSeccion></div>
      <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{sugerencia.mensajes[0]}</p>
      <EstadoConfianza estado="estimado" />
      {falta && (
        <p className="text-[15px] leading-snug pl-3.5 border-l-2" style={{ color: COLORS.inkSoft, borderColor: COLORS.star }}>
          Primero conviene armar un colchón de {fmtPesos(falta.meta)} (tres meses de tus gastos) en algo que puedas sacar rápido. Hoy tenés {fmtPesos(falta.actual)}.
        </p>
      )}
    </section>
  );
}

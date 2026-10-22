import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { COLORS, EstadoConfianza, TituloSeccion } from '../shared';

// "¿Cuánto invertir?" Sale de lo que a la persona le sobró el mes pasado: todo eso se puede invertir,
// sin apartar nada "por las dudas". Si no se sabe, esta sección no aparece: no hace falta contar lo
// que no sabemos.
export function CuantoPoner({ sugerencia }: { sugerencia: SugerenciaMonto }) {
  if (sugerencia.mensajes.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="cuanto-titulo">
      <div id="cuanto-titulo"><TituloSeccion>¿Cuánto invertir?</TituloSeccion></div>
      <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{sugerencia.mensajes[0]}</p>
      <EstadoConfianza estado="estimado" />
    </section>
  );
}

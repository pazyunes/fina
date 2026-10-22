import type { ProductoId } from '../../../lib/inversiones/catalogo';
import { ordenarTarjetas, TARJETAS } from '../../../lib/inversiones/aprender';
import { COLORS, TituloSeccion } from '../shared';
import { Desplegable } from './Desplegable';

// Cards para aprender "la diferencia entre algo y otra cosa", debajo de las recomendaciones.
// Cada una se abre al tocarla. Las que tienen que ver con lo que hoy se recomienda van primero.
export function AprendeCards({ recomendados }: { recomendados: ProductoId[] }) {
  const tarjetas = ordenarTarjetas(TARJETAS, recomendados);
  return (
    <section className="flex flex-col gap-3" aria-label="Aprendé la diferencia">
      <div className="flex flex-col gap-1">
        <TituloSeccion>Aprendé la diferencia</TituloSeccion>
        <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.inkSoft }}>
          Mini lecciones para entender las palabras y las opciones. Tocá la que quieras.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        {tarjetas.map((t) => (
          <div key={t.id} className="rounded-[28px] px-5" style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.line}` }}>
            <Desplegable titulo={t.titulo}>
              <div className="flex flex-col gap-3 pb-5">
                <p className="text-[15px] leading-relaxed" style={{ color: COLORS.inkSoft }}>{t.idea}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[t.izq, t.der].map((lado) => (
                    <div key={lado.nombre} className="rounded-2xl px-3.5 py-3" style={{ background: COLORS.tint }}>
                      <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{lado.nombre}</p>
                      <p className="text-[15px] leading-snug mt-1" style={{ color: COLORS.inkSoft }}>{lado.texto}</p>
                    </div>
                  ))}
                </div>
                {t.ejemplo && (
                  <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{t.ejemplo}</p>
                )}
                <p className="text-[15px] leading-snug pl-3.5 border-l-2" style={{ borderColor: COLORS.lima, color: COLORS.ink }}>
                  <span className="font-bold">Para quedarte con algo: </span>{t.retener}
                </p>
              </div>
            </Desplegable>
          </div>
        ))}
      </div>
    </section>
  );
}

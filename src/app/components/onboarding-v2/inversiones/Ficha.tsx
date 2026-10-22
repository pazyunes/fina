import type { Producto, Riesgo } from '../../../lib/inversiones/catalogo';
import { fechaCorta } from '../../../lib/inversiones/mercadoTipos';
import type { Veredicto } from '../../../lib/inversiones/motor';
import type { FichaRinde } from '../../../lib/inversiones/rinde';
import { COLORS, EstadoConfianza, type Confianza } from '../shared';

// Las piezas de la ficha de una inversión. Siempre las mismas, en el mismo
// orden y con el mismo estilo: así la persona aprende a leerlas una vez y las
// reconoce en cualquier inversión. Cada una es un "globito": un recuadro
// redondeado con una sola pregunta y una respuesta corta.

const RIESGO_FILL: Record<Riesgo, string> = { Bajo: COLORS.lima, Medio: COLORS.star, Alto: COLORS.naranja };
const PUNTO_VEREDICTO: Record<Veredicto, string> = {
  'le-gana': COLORS.lima, empata: COLORS.star, pierde: COLORS.naranja, variable: COLORS.tint, 'sin-dato': COLORS.tint,
};

export function Globito({ pregunta, children }: { pregunta: string; children: React.ReactNode }) {
  return (
    <section
      className="flex flex-col gap-2 rounded-[28px] px-5 py-4"
      style={{ background: COLORS.surface, border: `2px solid ${COLORS.lima}` }}
    >
      <h3 className="text-[17px] font-bold leading-snug" style={{ color: COLORS.ink }}>{pregunta}</h3>
      {children}
    </section>
  );
}

const TEXTO = 'text-[15px] leading-relaxed max-w-[62ch]';

export function GlobitoQueEs({ p }: { p: Producto }) {
  return <Globito pregunta="¿Qué es?"><p className={TEXTO} style={{ color: COLORS.inkSoft }}>{p.queEs}</p></Globito>;
}

export function GlobitoDonde({ p }: { p: Producto }) {
  return <Globito pregunta="¿Dónde queda tu plata?"><p className={TEXTO} style={{ color: COLORS.inkSoft }}>{p.dondeQuedaTuPlata}</p></Globito>;
}

export function GlobitoRiesgo({ p }: { p: Producto }) {
  return (
    <Globito pregunta="¿Qué riesgo tiene?">
      <p className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ color: COLORS.ink }}>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RIESGO_FILL[p.riesgo] }} aria-hidden />
        Riesgo {p.riesgo.toLowerCase()}
      </p>
      <p className={TEXTO} style={{ color: COLORS.inkSoft }}>{p.riesgoTexto}</p>
    </Globito>
  );
}

export function GlobitoCuando({ p }: { p: Producto }) {
  return <Globito pregunta="¿Cuándo la podés sacar?"><p className={TEXTO} style={{ color: COLORS.inkSoft }}>{p.cuandoLaSacas}</p></Globito>;
}

export function GlobitoGarantia({ p }: { p: Producto }) {
  return <Globito pregunta="¿Alguien la garantiza?"><p className={TEXTO} style={{ color: COLORS.inkSoft }}>{p.garantia}</p></Globito>;
}

/**
 * El glosario necesario: las palabras que aparecen en la explicación, explicadas.
 * Va ARRIBA de todo para que, si alguien se tropieza con una palabra, suba y la
 * encuentre. Se abre solo en la primera pantalla.
 */
export function GlosarioNecesario({ p, abierto = false }: { p: Producto; abierto?: boolean }) {
  if (p.glosario.length === 0) return null;
  return (
    <details
      open={abierto}
      className="rounded-[28px] px-5 py-3"
      style={{ background: COLORS.surface, border: `2px solid ${COLORS.lima}` }}
    >
      <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[17px] font-bold" style={{ color: COLORS.ink }}>
        Glosario necesario
      </summary>
      <dl className="flex flex-col gap-2.5 pb-2 pt-1">
        {p.glosario.map((g) => (
          <div key={g.termino}>
            <dt className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{g.termino}</dt>
            <dd className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{g.significado}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** ¿Cuánto rinde? El porcentaje, lo que significa por mes y un mini ejemplo con plata. */
export function GlobitoRinde({ ficha, confianza }: { ficha: FichaRinde | null; confianza: Confianza }) {
  if (!ficha) return null;
  return (
    <Globito pregunta="¿Cuánto rinde?">
      <p className="text-[28px] font-extrabold leading-none tracking-[-0.01em]" style={{ color: COLORS.ink }}>{ficha.titulo}</p>
      {ficha.detalle && <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>{ficha.detalle}</p>}
      <p className="text-[15px] leading-relaxed rounded-2xl px-3.5 py-3 mt-1" style={{ background: COLORS.tint, color: COLORS.ink }}>
        <span className="font-bold">Un ejemplo: </span>{ficha.ejemplo}
      </p>
      {ficha.aclaracion && <p className="text-[13px] leading-snug" style={{ color: COLORS.inkSoft }}>{ficha.aclaracion}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {ficha.chip && (
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: COLORS.inkSoft }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PUNTO_VEREDICTO[ficha.chip.veredicto] }} aria-hidden />
            {ficha.chip.texto}
          </span>
        )}
        {ficha.chip && <EstadoConfianza estado={confianza} />}
        {ficha.fecha && <span className="text-[12px]" style={{ color: COLORS.inkFaint }}>dato al {fechaCorta(ficha.fecha)}</span>}
      </div>
    </Globito>
  );
}

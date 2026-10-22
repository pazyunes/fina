import { PROVEEDORES, type ProveedorId } from '../../../lib/inversiones/catalogo';
import type { Mercado } from '../../../lib/inversiones/mercadoTipos';
import type { Recomendacion } from '../../../lib/inversiones/motor';
import { describirRinde } from '../../../lib/inversiones/rinde';
import type { SugerenciaMonto } from '../../../lib/inversiones/cuanto';
import { COLORS, Cta } from '../shared';
import { Globito, GlobitoCuando, GlobitoDonde, GlobitoGarantia, GlobitoGlosario, GlobitoQueEs, GlobitoRiesgo, GlobitoRinde } from './Ficha';
import { Hoja } from './Hoja';

// La ficha de una inversión: siempre las mismas preguntas, en el mismo orden,
// con respuestas cortas. Primero lo que más pesa para decidir (qué es, cuánto
// rinde, dónde queda tu plata, riesgo), después lo práctico (cuándo la sacás,
// garantía) y al final el glosario. Abajo, dónde hacerlo.
export function DetalleProducto({
  rec, mercado, usa, sugerencia, onElegir, onCerrar,
}: {
  rec: Recomendacion;
  mercado: Mercado;
  usa: ProveedorId[];
  sugerencia: SugerenciaMonto;
  onElegir: (proveedor: ProveedorId) => void;
  onCerrar: () => void;
}) {
  const p = rec.producto;
  const ficha = describirRinde(p.id, rec.mejor, mercado);
  const otros = rec.opciones.filter((o) => o.proveedor !== rec.mejor.proveedor);
  const mejor = PROVEEDORES[rec.mejor.proveedor];

  return (
    <Hoja titulo={p.nombre} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3.5">
        <GlobitoQueEs p={p} />
        <GlobitoRinde ficha={ficha} confianza={rec.mejor.confianza} />
        <GlobitoDonde p={p} />
        <GlobitoRiesgo p={p} />
        <GlobitoCuando p={p} />
        <GlobitoGarantia p={p} />
        {sugerencia.mensajes.length > 0 && (
          <Globito pregunta="¿Con cuánto empezar?">
            <p className="text-[15px] leading-relaxed" style={{ color: COLORS.inkSoft }}>{sugerencia.mensajes[0]}</p>
          </Globito>
        )}
        <GlobitoGlosario p={p} />
      </div>

      {rec.avisos.map((a) => (
        <p key={a} className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{a}</p>
      ))}

      <div className="flex flex-col gap-3">
        <Cta
          label={rec.opciones.length === 1 && mejor.tipo === 'banco' ? 'Empezar paso a paso' : `Empezar con ${mejor.nombre}`}
          onClick={() => onElegir(rec.mejor.proveedor)}
        />
        {usa.includes(rec.mejor.proveedor) && (
          <p className="text-[13px] text-center" style={{ color: COLORS.limaText }}>{mejor.nombre} ya lo usás.</p>
        )}
      </div>

      {otros.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[15px] font-bold" style={{ color: COLORS.ink }}>Esto también lo podés hacer con</p>
          <div className="flex flex-wrap gap-2">
            {otros.map((o) => (
              <button
                key={o.proveedor}
                type="button"
                onClick={() => onElegir(o.proveedor)}
                className="v2-focus min-h-[44px] rounded-full px-4 text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                style={{ border: `1.5px solid ${COLORS.brand}`, color: COLORS.brand }}
              >
                {PROVEEDORES[o.proveedor].nombre}{usa.includes(o.proveedor) ? ' · ya lo usás' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
        FINA nunca mueve tu plata: te explicamos y vos decidís y lo hacés en tu propia app.
      </p>
    </Hoja>
  );
}

import { PROVEEDORES, type ProveedorId, type Riesgo } from '../../../lib/inversiones/catalogo';
import { fechaCorta } from '../../../lib/inversiones/mercadoTipos';
import { pct } from '../../../lib/inversiones/formato';
import { lecturaContraInflacion, textoVeredicto, type Inflacion, type Recomendacion } from '../../../lib/inversiones/motor';
import { COLORS, Cta, EstadoConfianza, TituloSeccion } from '../shared';
import { Hoja, Parrafo } from './Hoja';

// El nivel de riesgo dicho en términos de lo que le puede pasar a la plata.
const RIESGO_EXPLICADO: Record<Riesgo, string> = {
  Bajo: 'El valor no suele bajar. Rinde menos, pero es lo más previsible.',
  Medio: 'Puede moverse en el camino. Suele acomodarse con el tiempo si podés esperar.',
  Alto: 'Sube y baja bastante, y puede haber años de pérdida. Es para plata que no vas a necesitar en mucho tiempo.',
};
const RIESGO_FILL: Record<Riesgo, string> = { Bajo: COLORS.lima, Medio: COLORS.star, Alto: COLORS.naranja };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <TituloSeccion>{titulo}</TituloSeccion>
      {children}
    </div>
  );
}

// El detalle de una recomendación. Responde, en orden, lo que de verdad frena a
// alguien que nunca invirtió: qué es, DÓNDE queda su plata, qué le puede pasar,
// cuándo la saca, si alguien se la garantiza — y recién después, dónde hacerlo.
export function DetalleProducto({
  rec, inflacion, usa, onElegir, onCerrar,
}: {
  rec: Recomendacion;
  inflacion: Inflacion;
  usa: ProveedorId[];
  onElegir: (proveedor: ProveedorId) => void;
  onCerrar: () => void;
}) {
  const p = rec.producto;
  const lectura = lecturaContraInflacion(rec.mejor, inflacion);

  return (
    <Hoja titulo={p.nombre} onCerrar={onCerrar}>
      <p className="text-[17px] leading-snug" style={{ color: COLORS.ink }}>{p.queEs}</p>

      <Seccion titulo="Hoy, con números">
        <p className="text-[15px] leading-relaxed max-w-[62ch]" style={{ color: COLORS.ink }}>
          {lectura ?? rec.mejor.detalle}
        </p>
        <Parrafo>
          Comparamos contra la inflación más alta que conocemos, {pct(inflacion.mensual * 100, 1)} por mes (unos {pct(inflacion.anual * 100, 0)} al año): {inflacion.mayor.etiqueta}.
        </Parrafo>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EstadoConfianza estado={rec.mejor.confianza} />
          {rec.mejor.fecha && (
            <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>dato al {fechaCorta(rec.mejor.fecha)}</span>
          )}
        </div>
        {rec.avisos.map((a) => (
          <p key={a} className="text-[14px] leading-snug font-semibold" style={{ color: COLORS.naranjaText }}>{a}</p>
        ))}
      </Seccion>

      <Seccion titulo="¿Dónde queda tu plata?">
        {p.dondeQuedaTuPlata.map((t) => <Parrafo key={t}>{t}</Parrafo>)}
      </Seccion>

      <Seccion titulo="¿Qué le puede pasar?">
        <p className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ color: COLORS.ink }}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RIESGO_FILL[p.riesgo] }} aria-hidden />
          Riesgo {p.riesgo.toLowerCase()}
        </p>
        <Parrafo>{RIESGO_EXPLICADO[p.riesgo]}</Parrafo>
        <Parrafo>{p.quePuedePasar}</Parrafo>
      </Seccion>

      <Seccion titulo="¿Cuándo la podés sacar?">
        <Parrafo>{p.cuandoLaSacas}</Parrafo>
      </Seccion>

      <Seccion titulo="¿Alguien me la garantiza?">
        <Parrafo>{p.garantia}</Parrafo>
      </Seccion>

      {p.glosario.length > 0 && (
        <details className="group">
          <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[15px] font-bold" style={{ color: COLORS.brand }}>
            Palabras que vas a ver
          </summary>
          <dl className="flex flex-col gap-2.5 pt-1">
            {p.glosario.map((g) => (
              <div key={g.termino}>
                <dt className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{g.termino}</dt>
                <dd className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{g.significado}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <Seccion titulo="¿Dónde hacerlo?">
        <div className="flex flex-col">
          {rec.opciones.map((o) => {
            const prov = PROVEEDORES[o.proveedor];
            const loUsa = usa.includes(o.proveedor);
            return (
              <div key={o.proveedor} className="flex flex-col gap-2 py-3.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[17px]" style={{ color: COLORS.ink }}>{prov.nombre}</span>
                  {loUsa && (
                    <span className="text-[12px] font-semibold rounded-full px-2 py-0.5" style={{ background: COLORS.limaSoft, color: COLORS.limaText }}>Ya lo usás</span>
                  )}
                  <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>{textoVeredicto(o.veredicto)}</span>
                </div>
                <Parrafo>{o.detalle}</Parrafo>
                {o.notas.map((n) => (
                  <p key={n} className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>{n}</p>
                ))}
                <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>Para empezar necesitás {prov.paraEmpezar.charAt(0).toLowerCase() + prov.paraEmpezar.slice(1)}</p>
                <button
                  type="button"
                  onClick={() => onElegir(o.proveedor)}
                  className="v2-focus self-start min-h-[44px] rounded-full px-4 text-[15px] font-bold transition-all duration-100 active:scale-[0.98]"
                  style={{ border: `1.5px solid ${COLORS.brand}`, color: COLORS.brand }}
                >
                  Empezar con {prov.nombre}
                </button>
              </div>
            );
          })}
        </div>
      </Seccion>

      {rec.opciones.length === 1 && <Cta label="Empezar paso a paso" onClick={() => onElegir(rec.opciones[0].proveedor)} />}

      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
        FINA nunca mueve tu plata: te explicamos y vos decidís y lo hacés en tu propia app.
      </p>
    </Hoja>
  );
}

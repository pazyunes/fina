import { fechaCorta, type Mercado } from '../../../lib/inversiones/mercadoTipos';
import { indicadores } from '../../../lib/inversiones/motor';
import { COLORS } from '../shared';
import { Desplegable } from './Desplegable';

// Los números del mercado sobre los que se arman las recomendaciones, a la
// vista y con su fecha. Si alguien quiere saber "¿por qué me dicen esto?", acá
// está la respuesta: son estos datos, de estas fechas.
export function MercadoHoy({ mercado }: { mercado: Mercado }) {
  // Sólo lo que está al día: un número viejo no se muestra (y si falta algo esencial, la pantalla ni llega acá).
  const lista = indicadores(mercado).filter((i) => i.vigente);
  return (
    <Desplegable titulo="Los números de hoy en los que nos basamos">
      <div className="flex flex-col pt-1">
        {lista.map((i) => (
          <div key={i.id} className="flex items-baseline justify-between gap-4 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
            <span className="flex flex-col min-w-0">
              <span className="text-[15px]" style={{ color: COLORS.ink }}>{i.etiqueta}</span>
              <span className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>
                al {fechaCorta(i.fecha)} · {i.fuente}
              </span>
            </span>
            <span className="font-mono tabular-nums text-[15px] font-semibold shrink-0" style={{ color: COLORS.ink }}>{i.valor}</span>
          </div>
        ))}
      </div>
    </Desplegable>
  );
}

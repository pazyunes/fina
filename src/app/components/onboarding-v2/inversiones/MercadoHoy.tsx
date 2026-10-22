import { fechaCorta, type Mercado } from '../../../lib/inversiones/mercadoTipos';
import { indicadores } from '../../../lib/inversiones/motor';
import { COLORS } from '../shared';

// Los números del mercado sobre los que se arman las recomendaciones, a la
// vista y con su fecha. Si alguien quiere saber "¿por qué me dicen esto?", acá
// está la respuesta: son estos datos, de estas fechas.
export function MercadoHoy({ mercado }: { mercado: Mercado }) {
  const lista = indicadores(mercado);
  return (
    <details className="group">
      <summary className="v2-focus cursor-pointer min-h-[44px] flex items-center text-[15px] font-bold" style={{ color: COLORS.brand }}>
        Los números de hoy en los que nos basamos
      </summary>
      <div className="flex flex-col pt-1">
        {lista.map((i) => (
          <div key={i.id} className="flex items-baseline justify-between gap-4 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
            <span className="flex flex-col min-w-0">
              <span className="text-[15px]" style={{ color: COLORS.ink }}>{i.etiqueta}</span>
              <span className="text-[12px] leading-snug" style={{ color: COLORS.inkFaint }}>
                {i.vigente ? `al ${fechaCorta(i.fecha)}` : `desactualizado, es del ${fechaCorta(i.fecha)}`} · {i.fuente}
              </span>
            </span>
            <span className="font-mono tabular-nums text-[15px] font-semibold shrink-0" style={{ color: COLORS.ink }}>{i.valor}</span>
          </div>
        ))}
      </div>
      {mercado.fallas.length > 0 && (
        <p className="text-[13px] leading-snug pt-2" style={{ color: COLORS.inkFaint }}>
          Algunas fuentes no respondieron hoy ({mercado.fallas.map((f) => f.split(':')[0]).join(', ')}). Lo que depende de ellas no se recomienda hasta tener el dato.
        </p>
      )}
    </details>
  );
}

import { useState } from 'react';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { compararConMesPasado, diaArgentina, type Paso } from '../../api/v2/pasos';
import { COLORS, fmtMoney } from './shared';

// Los pasos de revisión del nivel 3 ("Compará tu mes con el anterior",
// "Compará Delivery con el mes pasado") se hacen acá mismo, en Home: los dos
// números, contra qué se comparan, y una pregunta. Contestarla cumple el paso,
// igual que la pregunta del nivel financiero. La pregunta no tiene respuesta
// correcta: es para mirar el número un segundo, no para juzgarlo.
//
// Va debajo del paso y no dentro del globo: Fini no va al lado de un número.

const RESPUESTAS = ['Más o menos lo que pensaba', 'Pensaba que menos', 'Pensaba que más'];

export function RevisionDelPaso({ paso, onRespondida }: { paso: Paso; onRespondida: () => void }) {
  const { estado } = useAlmacen();
  const [elegida, setElegida] = useState<number | null>(null);
  const hoy = diaArgentina();
  const c = compararConMesPasado(estado, hoy, paso.revision === 'seccion' ? paso.ref : null);
  const nombre = paso.revision === 'seccion' && paso.ref ? estado.secciones.find((s) => s.id === paso.ref)?.nombre ?? 'Esta sección' : null;
  const dif = c.esteMes - c.mismosDiasMesPasado;
  // "Casi lo mismo" si la diferencia es menor al 5%: decir "$300 más" sobre
  // $200.000 es ruido.
  const parecido = c.mismosDiasMesPasado > 0 && Math.abs(dif) / c.mismosDiasMesPasado < 0.05;
  const lectura = parecido
    ? 'Casi lo mismo que a esta altura del mes pasado.'
    : `${fmtMoney(Math.abs(dif))} ${dif > 0 ? 'más' : 'menos'} que a esta altura del mes pasado.`;

  return (
    <section className="flex flex-col gap-4 -mt-2" aria-live="polite">
      <div className="flex flex-col">
        <Fila label={nombre ? `${nombre}, este mes hasta hoy` : 'Este mes, hasta hoy'} valor={c.esteMes} fuerte />
        <Fila label={`Del 1 al ${c.diaDelMes} del mes pasado`} valor={c.mismosDiasMesPasado} />
      </div>
      <p className="text-[14px] leading-snug font-mono tabular-nums" style={{ color: COLORS.ink }}>{lectura}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-semibold mb-2" style={{ color: COLORS.ink }}>¿Es lo que esperabas?</legend>
        {RESPUESTAS.map((r, i) => (
          <button
            key={r}
            type="button"
            disabled={elegida !== null}
            aria-pressed={elegida === i}
            onClick={() => { setElegida(i); onRespondida(); }}
            className="v2-focus w-full min-h-[44px] px-4 py-2.5 rounded-xl text-left text-[14px] font-medium"
            style={elegida === i
              ? { background: COLORS.brandSoft, color: COLORS.brandDark, border: `1.5px solid ${COLORS.brandSoft}` }
              : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
          >
            {r}
          </button>
        ))}
      </fieldset>
    </section>
  );
}

function Fila({ label, valor, fuerte = false }: { label: string; valor: number; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: COLORS.line }}>
      <span className="text-[14px]" style={{ color: COLORS.inkSoft }}>{label}</span>
      <span className={`font-mono tabular-nums ${fuerte ? 'text-[16px] font-semibold' : 'text-[15px] font-medium'}`} style={{ color: COLORS.ink }}>
        {fmtMoney(valor)}
      </span>
    </div>
  );
}

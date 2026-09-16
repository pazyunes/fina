import { useEffect, useState } from 'react';
import { Fini } from './Fini';
import { COLORS, EstadoConfianza, FONTS, TituloSeccion } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { diaArgentina, pasosPosiblesManana } from '../../api/v2/pasos';
import {
  PERIODOS_RECOMENDACION, leerRecomendaciones, marcarUtil, recomendacionesRecordadas,
  type PeriodoRecomendacion, type Recomendaciones as RecomendacionesT, type TarjetaRecomendacion,
} from '../../api/v2/recomendaciones';

// "Para vos": una recomendación para hoy, una para la semana y una para el mes,
// armadas a partir de lo que hace esta persona. Las escribe un modelo de IA en el
// servidor (api/recomendaciones.ts), que además recuerda lo que fue viendo y lo
// que le sirvió a la persona.
//
// Van una debajo de la otra y no en un carrusel: son texto para leer, y lo que
// queda fuera de la pantalla en un carrusel de texto no se lee nunca.
//
// Reglas que se ven acá:
// · Todo dato lleva su referencia ("contra los mismos días del mes pasado").
// · Lo estimado se marca como estimado (regla 4).
// · Sin colores de alerta: una recomendación no es un reto (regla 3).
// · Dice que es IA y que no es asesoramiento financiero.

const ETIQUETA: Record<PeriodoRecomendacion, string> = { dia: 'Para hoy', semana: 'Esta semana', mes: 'Este mes' };

// ── Recomendaciones generales ────────────────────────────────────────────
// Mientras no hay datos suficientes para personalizar (o mientras se arman, o
// si algo falla), se muestra un consejo general por período. Rotan por día,
// semana y mes para que no sea siempre el mismo. No usan IA ni cuestan nada.
//
// Son para ENTENDER la plata, no tareas: las tareas ("registrá un gasto",
// "poné un tope") ya las propone el paso del día, y repetirlas acá pisaba esa
// tarjeta. Tampoco llevan botón: son para leer, y con un botón por consejo la
// sección quedaba cargada.
//
// Salen de lo mismo que el prompt de la IA: un gasto no es un error, los
// gustos chicos no son el problema, lo automático le gana a la fuerza de
// voluntad, y el contexto argentino (inflación, cuotas, préstamos rápidos). Sin
// montos ni instrumentos de inversión.
type General = { titulo: string; texto: string };

const GENERALES: Record<PeriodoRecomendacion, General[]> = {
  dia: [
    { titulo: 'Un gasto no es un error', texto: 'Anotar lo que gastás no es para culparte: es para ver. Con los números a la vista, decidir en qué gastar es más fácil.' },
    { titulo: 'El café no es el problema', texto: 'Los gustos chicos casi no mueven tus finanzas. Lo que más pesa suele ser lo que se repite sin que lo decidas: suscripciones, cuotas, el delivery de todas las semanas.' },
    { titulo: 'Las cuotas son parte de tus próximos sueldos', texto: 'Con inflación, las cuotas sin interés pueden convenir. Lo importante es saber cuánto de lo que vas a cobrar ya está comprometido.' },
    { titulo: 'Tu referencia sos vos', texto: 'Lo que gasta otra persona no dice nada de tus finanzas. La comparación que sirve es con tu propio mes anterior.' },
  ],
  semana: [
    { titulo: 'Lo automático le gana a la fuerza de voluntad', texto: 'Una decisión que se toma una sola vez, como separar apenas cobrás, funciona mejor que proponerse ahorrar todos los días.' },
    { titulo: 'Con inflación, la plata quieta vale menos', texto: 'Los pesos guardados sin moverse compran menos cada mes. Por eso conviene conocer las opciones que existen para cuidarlos.' },
    { titulo: 'Primero, un colchón', texto: 'Antes de pensar en invertir, tener algo apartado para imprevistos evita endeudarte cuando pasa algo que no esperabas.' },
  ],
  mes: [
    { titulo: 'Los préstamos rápidos salen caros', texto: 'Las apps y financieras que prestan en minutos suelen cobrar tasas muy altas. Si necesitás plata, mirá el costo total antes de aceptar.' },
    { titulo: 'Lo fijo marca tu margen', texto: 'Alquiler, servicios, transporte, suscripciones: saber cuánto se lleva lo fijo te dice cuánto te queda de verdad para decidir.' },
    { titulo: 'Un para qué hace que el ahorro dure', texto: 'Ahorrar "por las dudas" cuesta sostenerlo. Con un para qué y un cuándo, aunque sea chico, se vuelve concreto.' },
  ],
};

/** El consejo general que toca hoy: cambia cada día, cada semana o cada mes. */
function generalDe(periodo: PeriodoRecomendacion): General {
  const hoy = diaArgentina();
  const dias = Math.floor(Date.parse(`${hoy}T12:00:00Z`) / 86_400_000);
  const n = periodo === 'dia' ? dias : periodo === 'semana' ? Math.floor((dias + 3) / 7) : Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7));
  const lista = GENERALES[periodo];
  return lista[n % lista.length];
}

export function Recomendaciones() {
  const [datos, setDatos] = useState<RecomendacionesT | null>(() => recomendacionesRecordadas());
  const [fallo, setFallo] = useState(false);
  const { estado } = useAlmacen();
  const { paso } = usePasoDelDia();

  useEffect(() => {
    let vivo = true;
    // Junto con la recomendación del día, la IA elige el paso de mañana entre
    // los que la persona puede cumplir.
    void leerRecomendaciones(pasosPosiblesManana(estado, paso?.clave ?? null)).then((r) => {
      if (!vivo) return;
      if (r.error !== null) { if (!recomendacionesRecordadas()) setFallo(true); return; }
      setFallo(false);
      setDatos(r.data);
    });
    return () => { vivo = false; };
  }, []);

  // Falta registrar para que se personalicen: se lo recuerda un cartel abajo.
  const faltanDatos = !!datos && PERIODOS_RECOMENDACION.some((p) => datos[p].estado === 'faltan_datos');
  const hayPersonalizadas = !!datos && PERIODOS_RECOMENDACION.some((p) => datos[p].estado === 'lista');

  function marcar(id: string, util: boolean | null) {
    setDatos((d) => {
      if (!d) return d;
      const nuevo = { ...d };
      for (const p of PERIODOS_RECOMENDACION) {
        const t = d[p];
        if (t.estado === 'lista' && t.id === id) nuevo[p] = { ...t, util };
      }
      return nuevo;
    });
    void marcarUtil(id, util).then((r) => {
      // Si no se guardó, se vuelve atrás: la marca no puede decir algo que la
      // base no sabe.
      if (r.error !== null) void leerRecomendaciones().then((x) => { if (x.error === null) setDatos(x.data); });
    });
  }

  return (
    <section className="flex flex-col gap-2" aria-busy={!datos && !fallo}>
      <TituloSeccion>Para vos</TituloSeccion>

      {/* Mientras se arman las personalizadas (la primera vez tarda), se ven las
          generales, no una espera vacía. */}
      {!datos && !fallo && (
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 -ml-1"><Fini state="pensando" size={44} /></div>
          <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }} role="status">
            Estoy armando tus recomendaciones con tus datos. Mientras, algunas que le sirven a cualquiera:
          </p>
        </div>
      )}

      <div className="flex flex-col">
        {PERIODOS_RECOMENDACION.map((p) => (
          datos && datos[p].estado === 'lista'
            ? <Tarjeta key={p} periodo={p} tarjeta={datos[p]} onMarcar={marcar} />
            : <TarjetaGeneral key={p} periodo={p} />
        ))}
      </div>

      {faltanDatos && (
        <div className="rounded-2xl px-4 py-3.5 mt-1" style={{ background: COLORS.brandSoft }}>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
            <strong>Recordá registrar tus gastos.</strong> Con unos días anotados, estas recomendaciones se arman con tus números y cómo te manejás.
          </p>
        </div>
      )}

      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
        {hayPersonalizadas
          ? 'Las personalizadas se hacen con IA a partir de tus datos. No son asesoramiento financiero.'
          : 'Recomendaciones generales. No son asesoramiento financiero.'}
      </p>
    </section>
  );
}

function Tarjeta({ periodo, tarjeta, onMarcar }: {
  periodo: PeriodoRecomendacion;
  tarjeta: TarjetaRecomendacion;
  onMarcar: (id: string, util: boolean | null) => void;
}) {
  const etiqueta = (
    <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
      {ETIQUETA[periodo]}
    </p>
  );

  if (tarjeta.estado !== 'lista') return <TarjetaGeneral periodo={periodo} />;

  const { contenido: r, id, util } = tarjeta;

  return (
    <article className="py-4 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      {etiqueta}
      <h3 className="text-[18px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{r.titulo}</h3>
      <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.texto}</p>

      {/* El dato en el que se apoya, con contra qué se compara. */}
      <div className="flex flex-col gap-0.5 pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
        <p className="text-[16px] font-semibold font-mono tabular-nums" style={{ color: COLORS.ink }}>{r.dato.valor}</p>
        <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.dato.referencia}</p>
        {r.confianza === 'estimado' && <EstadoConfianza estado="estimado" />}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        {/* Lo que marca la persona es lo que usa el modelo la próxima vez para
            no insistir con lo que no le sirve. Tocar de nuevo saca la marca. */}
        <div className="flex items-center gap-1" role="group" aria-label="¿Te sirvió esta recomendación?">
          <span className="text-[14px] mr-1" style={{ color: COLORS.inkFaint }}>¿Te sirvió?</span>
          {([true, false] as const).map((v) => {
            const elegido = util === v;
            return (
              <button
                key={String(v)}
                type="button"
                aria-pressed={elegido}
                onClick={() => onMarcar(id, elegido ? null : v)}
                className="v2-focus min-h-[44px] min-w-[44px] px-3 rounded-full text-[14px] font-semibold"
                style={elegido
                  ? { background: COLORS.brandSoft, color: COLORS.brandDark }
                  : { color: COLORS.inkSoft, border: `1.5px solid ${COLORS.line}` }}
              >
                {v ? 'Sí' : 'No'}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function TarjetaGeneral({ periodo }: { periodo: PeriodoRecomendacion }) {
  const r = generalDe(periodo);
  return (
    <article className="py-4 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
        {ETIQUETA[periodo]}
      </p>
      <h3 className="text-[18px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{r.titulo}</h3>
      <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.texto}</p>
    </article>
  );
}

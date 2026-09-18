import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Fini } from './Fini';
import { CheckIcon, COLORS, EstadoConfianza, FONTS, TituloSeccion } from './shared';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { diaArgentina, pasosPosiblesManana } from '../../api/v2/pasos';
import {
  PERIODOS_RECOMENDACION, clavesDeHoy, leerHechas, leerRecomendaciones, marcarHecha, marcarUtil, recomendacionesRecordadas,
  type PeriodoRecomendacion, type Recomendacion, type Recomendaciones as RecomendacionesT,
} from '../../api/v2/recomendaciones';

// "Para vos": una recomendación para hoy, una para la semana y una para el mes.
//
// Cada una se puede TACHAR. Al tacharla aparece la siguiente de ese período, y
// cuando cambia el día, la semana o el mes vuelven a empezar. El orden de cada
// período es:
//   1. la que armó la IA con los datos de la persona (si hay);
//   2. los consejos generales de la app, rotando desde el que toca en ese
//      período, así no arrancan siempre por el mismo.
// Cuando tachó todas, se lo dice y se le avisa cuándo hay nuevas.
//
// No se pide otra a la IA al tachar: tardaría hasta un minuto y costaría otra
// llamada cada vez. Lo que sí hace la IA es leer cuáles tachó, al armar las
// siguientes (ver api/recomendaciones.ts).
//
// Reglas que se ven acá:
// · Todo dato lleva su referencia ("contra los mismos días del mes pasado").
// · Lo estimado se marca como estimado (regla 4).
// · Sin colores de alerta: una recomendación no es un reto (regla 3).
// · Sin botones de acción: las tareas las propone el paso del día.

const ETIQUETA: Record<PeriodoRecomendacion, string> = { dia: 'Para hoy', semana: 'Esta semana', mes: 'Este mes' };
const CUANDO_HAY_NUEVAS: Record<PeriodoRecomendacion, string> = { dia: 'Mañana hay otras.', semana: 'La semana que viene hay otras.', mes: 'El mes que viene hay otras.' };
const LISTO: Record<PeriodoRecomendacion, string> = { dia: 'Hiciste todas las de hoy', semana: 'Hiciste todas las de esta semana', mes: 'Hiciste todas las de este mes' };

// ── Consejos generales ───────────────────────────────────────────────────
// Cosas chicas para hacer o mirar, que se pueden tachar. NO son las tareas que
// ya propone el paso del día (registrar un gasto, poner un tope, sumarle a un
// objetivo…): son de afuera de la app, para entender y ordenar la plata.
//
// Salen de lo mismo que el prompt de la IA: un gasto no es un error, los
// gustos chicos no son el problema, lo automático le gana a la fuerza de
// voluntad, y el contexto argentino (inflación, cuotas, préstamos rápidos). Sin
// montos ni instrumentos de inversión. No usan IA ni cuestan nada.
type General = { titulo: string; texto: string };

const GENERALES: Record<PeriodoRecomendacion, General[]> = {
  dia: [
    { titulo: 'Fijate qué gasto de hoy fue un gusto', texto: 'No para culparte: para saber qué disfrutás. Los gastos que valorás se sostienen; los que no, se pueden soltar sin extrañarlos.' },
    { titulo: 'Sumá cuánto pagás por mes en cuotas', texto: 'Entre todas las que tenés. Es plata de tus próximos sueldos que ya está comprometida, y conviene saber cuánta es.' },
    { titulo: 'Mirá qué suscripciones te cobraron', texto: 'En el resumen de la tarjeta o de tu billetera virtual. Las que no usás son plata que se va sola todos los meses.' },
    { titulo: 'Antes de una compra grande, dejala pasar un día', texto: 'Si al otro día la seguís queriendo igual, adelante. Muchas compras de impulso no pasan esa prueba.' },
    { titulo: 'Si te ofrecen un préstamo, mirá el costo total', texto: 'No la cuota: el CFT (costo financiero total). Es lo que de verdad terminás pagando, y en los préstamos rápidos suele ser muy alto.' },
    { titulo: 'Compará tu gasto con tu mes, no con el de otros', texto: 'Lo que gasta otra persona no dice nada de tus finanzas. La referencia que sirve es cómo te fue a vos.' },
  ],
  semana: [
    { titulo: 'Elegí un día fijo para mirar tus números', texto: 'Cinco minutos, siempre el mismo día. Lo que se mira seguido se ordena casi solo.' },
    { titulo: 'Decidí cuánto separar antes de cobrar', texto: 'Una decisión que se toma una sola vez funciona mejor que proponerse ahorrar todos los días. Una vez que entra la plata, cuesta más.' },
    { titulo: 'Encontrá el gasto que se repite', texto: 'Delivery, transporte, salidas: el que aparece todas las semanas es donde más margen hay, mucho más que en los gustos chicos.' },
    { titulo: 'Hablá de plata con alguien de confianza', texto: 'Contar en qué andás ayuda a sostenerlo. No hace falta dar números.' },
  ],
  mes: [
    { titulo: 'Calculá tus gastos fijos del mes', texto: 'Alquiler, servicios, transporte, suscripciones. Lo que queda después es tu margen de verdad para decidir.' },
    { titulo: 'Averiguá cuánto rinde tu plata guardada', texto: 'Con inflación, los pesos quietos compran menos cada mes. Saber si tu plata le gana o le pierde es el primer paso para decidir.' },
    { titulo: 'Definí de cuánto querés tu colchón', texto: 'Cuántos meses de gastos fijos querés tener apartados para imprevistos. Aunque tardes en llegar, tener el número ayuda.' },
    { titulo: 'Leé el resumen de tu tarjeta completo', texto: 'No solo el total a pagar: qué cuotas siguen y cuándo terminan. Así sabés cuánto de los próximos meses ya está usado.' },
  ],
};

/** Desde qué consejo arranca cada período: cambia cada día, cada semana o cada mes. */
function inicioDe(periodo: PeriodoRecomendacion): number {
  const hoy = diaArgentina();
  const dias = Math.floor(Date.parse(`${hoy}T12:00:00Z`) / 86_400_000);
  const n = periodo === 'dia' ? dias : periodo === 'semana' ? Math.floor((dias + 3) / 7) : Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7));
  return n % GENERALES[periodo].length;
}

type Item =
  | { tipo: 'ia'; ref: string; id: string; contenido: Recomendacion; util: boolean | null }
  | { tipo: 'general'; ref: string; contenido: General };

function colaDe(periodo: PeriodoRecomendacion, datos: RecomendacionesT | null): Item[] {
  const cola: Item[] = [];
  const t = datos?.[periodo];
  if (t && t.estado === 'lista') cola.push({ tipo: 'ia', ref: `ia:${t.id}`, id: t.id, contenido: t.contenido, util: t.util });
  const lista = GENERALES[periodo];
  const inicio = inicioDe(periodo);
  for (let i = 0; i < lista.length; i++) {
    const n = (inicio + i) % lista.length;
    cola.push({ tipo: 'general', ref: `general:${periodo}:${n}`, contenido: lista[n] });
  }
  return cola;
}

/**
 * Sin nada a la vista: sólo hace la llamada diaria a la IA.
 *
 * "Para vos" se sacó de Home, pero esa misma llamada es la que elige el paso
 * del día de mañana (con su mensaje) y arma el plan semanal de cada objetivo.
 * Sin ella, el paso volvería a elegirse por rotación fija.
 */
export function PrepararManana() {
  const { estado } = useAlmacen();
  const { paso } = usePasoDelDia();
  useEffect(() => {
    void leerRecomendaciones(pasosPosiblesManana(estado, paso?.clave ?? null));
    // Una vez por visita a Home; la API guarda lo del día y no repite la llamada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function Recomendaciones() {
  const [datos, setDatos] = useState<RecomendacionesT | null>(() => recomendacionesRecordadas());
  const [fallo, setFallo] = useState(false);
  const [claves] = useState(() => clavesDeHoy());
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  const { estado } = useAlmacen();
  const { paso } = usePasoDelDia();

  useEffect(() => {
    let vivo = true;
    void leerHechas(claves).then((h) => { if (vivo) setHechas(h); });
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

  function marcarUtilidad(id: string, util: boolean | null) {
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

  async function tachar(periodo: PeriodoRecomendacion, ref: string): Promise<boolean> {
    const r = await marcarHecha(periodo, claves[periodo], ref);
    if (r.error !== null) return false;
    setHechas((h) => new Set(h).add(`${periodo}|${ref}`));
    return true;
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
        {PERIODOS_RECOMENDACION.map((p) => {
          const actual = colaDe(p, datos).find((it) => !hechas.has(`${p}|${it.ref}`)) ?? null;
          return (
            <Tarjeta
              // La key cambia con la recomendación: al tachar, la nueva entra
              // como una tarjeta nueva y no hereda el estado de la anterior.
              key={`${p}-${actual?.ref ?? 'listo'}`}
              periodo={p}
              item={actual}
              onTachar={(ref) => tachar(p, ref)}
              onUtil={marcarUtilidad}
            />
          );
        })}
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

function Tarjeta({ periodo, item, onTachar, onUtil }: {
  periodo: PeriodoRecomendacion;
  item: Item | null;
  onTachar: (ref: string) => Promise<boolean>;
  onUtil: (id: string, util: boolean | null) => void;
}) {
  const reducir = useReducedMotion();
  // Se ve tachada un momento antes de dar paso a la siguiente: si cambiara en
  // el acto, no se entendería qué pasó con la que se tocó.
  const [tachando, setTachando] = useState(false);
  const [error, setError] = useState(false);

  const etiqueta = (
    <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
      {ETIQUETA[periodo]}
    </p>
  );

  if (!item) {
    return (
      <article className="py-4 border-b last:border-b-0 flex items-center gap-3" style={{ borderColor: COLORS.line }}>
        <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: COLORS.brand }} aria-hidden>
          <CheckIcon />
        </span>
        <div className="flex flex-col gap-0.5">
          {etiqueta}
          <p className="text-[16px] font-bold" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>¡{LISTO[periodo]}!</p>
          <p className="text-[14px]" style={{ color: COLORS.inkSoft }}>{CUANDO_HAY_NUEVAS[periodo]}</p>
        </div>
      </article>
    );
  }

  async function tachar() {
    if (tachando || !item) return;
    setError(false);
    setTachando(true);
    // Se guarda y, a la vez, se deja ver el tachado un momento.
    const [ok] = await Promise.all([onTachar(item.ref), reducir ? Promise.resolve() : new Promise((r) => setTimeout(r, 500))]);
    if (!ok) { setTachando(false); setError(true); }
  }

  const r = item.contenido;
  return (
    <article className="py-4 border-b last:border-b-0 flex gap-3" style={{ borderColor: COLORS.line }}>
      {/* La casilla para tacharla. Target de 44px; el círculo dibujado es más chico. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={tachando}
        aria-label={`Marcar como hecha: ${r.titulo}`}
        onClick={() => void tachar()}
        className="v2-focus w-11 h-11 -ml-2 -mt-2 shrink-0 rounded-full flex items-center justify-center"
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
          style={tachando ? { background: COLORS.brand } : { border: `2px solid ${COLORS.lineStrong}` }}
        >
          {tachando && <CheckIcon />}
        </span>
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-2 transition-opacity duration-300" style={{ opacity: tachando ? 0.55 : 1 }}>
        {etiqueta}
        <h3
          className="text-[18px] font-bold leading-tight"
          style={{ color: COLORS.ink, fontFamily: FONTS.display, textDecoration: tachando ? 'line-through' : 'none' }}
        >
          {r.titulo}
        </h3>
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.texto}</p>

        {item.tipo === 'ia' && (
          <>
            {/* El dato en el que se apoya, con contra qué se compara. */}
            <div className="flex flex-col gap-0.5 pl-3.5 border-l-2" style={{ borderColor: COLORS.brandSoft }}>
              <p className="text-[16px] font-semibold font-mono tabular-nums" style={{ color: COLORS.ink }}>{item.contenido.dato.valor}</p>
              <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{item.contenido.dato.referencia}</p>
              {item.contenido.confianza === 'estimado' && <EstadoConfianza estado="estimado" />}
            </div>

            {/* Lo que marca la persona es lo que usa el modelo la próxima vez
                para no insistir con lo que no le sirve. Tocar de nuevo saca la marca. */}
            <div className="flex items-center gap-1 pt-1" role="group" aria-label="¿Te sirvió esta recomendación?">
              <span className="text-[14px] mr-1" style={{ color: COLORS.inkFaint }}>¿Te sirvió?</span>
              {([true, false] as const).map((v) => {
                const elegido = item.util === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => onUtil(item.id, elegido ? null : v)}
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
          </>
        )}

        {error && (
          <p role="alert" className="text-[14px] font-semibold" style={{ color: COLORS.coralDark }}>No se pudo guardar. Probá de nuevo.</p>
        )}
      </div>
    </article>
  );
}

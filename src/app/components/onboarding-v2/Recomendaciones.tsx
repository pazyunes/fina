import { useEffect, useState } from 'react';
import { COLORS, EstadoConfianza, FONTS, fmtMoney } from './shared';
import { Fini } from './Fini';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { diaArgentina, pasosPosiblesManana } from '../../api/v2/pasos';
import type { EstadoV2 } from '../../api/v2/tipos';
import {
  PERIODOS_RECOMENDACION, clavesDeHoy, leerHechas, leerRecomendaciones, marcarUtil, recomendacionesRecordadas,
  type PeriodoRecomendacion, type Recomendacion, type Recomendaciones as RecomendacionesT,
} from '../../api/v2/recomendaciones';

// "Para vos": una recomendación para hoy, una para la semana y una para el mes.
//
// Se muestra como un mensaje, no como una tarea: antes se podía tachar, pero
// no es algo que se cumple, y la casilla competía con el paso del día (DEBT
// I10). Lo que se tachó antes de este cambio sigue sin volver a aparecer
// (`leerHechas`). Cambia sola cuando cambia el día, la semana o el mes. El
// orden de cada período es:
//   1. la que armó la IA con los datos de la persona (si hay);
//   2. los consejos generales de la app, rotando desde el que toca en ese
//      período, así no arrancan siempre por el mismo.
//
// Reglas que se ven acá:
// · Todo dato lleva su referencia ("contra los mismos días del mes pasado").
// · Lo estimado se marca como estimado (regla 4).
// · Sin colores de alerta: una recomendación no es un reto (regla 3).
// · Sin botones de acción: las tareas las propone el paso del día.

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
  | { tipo: 'calculada'; ref: string; contenido: Recomendacion }
  | { tipo: 'general'; ref: string; contenido: General };

// ── Un tope sugerido con lo que la persona suele gastar ──────────────────
// Se calcula acá, sin IA ni costo, con sus propios gastos de los últimos 30
// días: la sección donde más gastó y todavía no tiene tope. Es una ESTIMACIÓN
// y por eso se da como rango, nunca como un número exacto (regla 4), y sin
// tono de reto (regla 3): es una opción, no una orden.
function redondear(n: number): number {
  const paso = n >= 10_000 ? 1_000 : 100;
  return Math.max(paso, Math.round(n / paso) * paso);
}
function topeSugerido(estado: EstadoV2, periodo: 'semana' | 'mes'): Recomendacion | null {
  const desde = Date.now() - 30 * 86_400_000;
  const recientes = estado.gastos.filter((g) => g.ts >= desde && g.seccionId);
  let mejor: { nombre: string; total: number; cant: number } | null = null;
  for (const sec of estado.secciones) {
    if (sec.tope) continue;
    const dela = recientes.filter((g) => g.seccionId === sec.id);
    const total = dela.reduce((a, g) => a + g.montoArs, 0);
    if (dela.length >= 3 && total > 0 && (!mejor || total > mejor.total)) mejor = { nombre: sec.nombre, total, cant: dela.length };
  }
  if (!mejor) return null;
  const base = periodo === 'mes' ? mejor.total : (mejor.total / 30) * 7;
  const bajo = redondear(base * 0.85);
  const alto = redondear(base);
  return {
    titulo: `Probá un tope para ${mejor.nombre}`,
    texto: periodo === 'mes'
      ? 'Es la sección donde más se te fue y todavía no tiene tope. Un tope parecido a lo que ya gastás te avisa cuánto te queda sin pedirte que cambies nada; si querés recortar un poco, apuntá a la parte de abajo del rango.'
      : 'Por semana se ve más rápido cuánto te queda. Un tope parecido a lo que ya gastás no te pide cambiar nada; si querés recortar un poco, apuntá a la parte de abajo del rango.',
    dato: {
      valor: `Entre ${fmtMoney(bajo)} y ${fmtMoney(alto)} por ${periodo === 'mes' ? 'mes' : 'semana'}`,
      referencia: `Gastaste ${fmtMoney(mejor.total)} en ${mejor.nombre} los últimos 30 días (${mejor.cant} gastos)`,
    },
    confianza: 'estimado',
    accion: null,
  };
}

function colaDe(periodo: PeriodoRecomendacion, datos: RecomendacionesT | null, estado: EstadoV2): Item[] {
  const cola: Item[] = [];
  const t = datos?.[periodo];
  if (t && t.estado === 'lista') cola.push({ tipo: 'ia', ref: `ia:${t.id}`, id: t.id, contenido: t.contenido, util: t.util });
  // Los topes sugeridos se miran una vez por semana y por mes; ver `topeSugerido`.
  if (periodo !== 'dia') {
    const calc = topeSugerido(estado, periodo);
    if (calc) cola.push({ tipo: 'calculada', ref: `calculada:tope:${periodo}:${calc.titulo}`, contenido: calc });
  }
  const lista = GENERALES[periodo];
  const inicio = inicioDe(periodo);
  for (let i = 0; i < lista.length; i++) {
    const n = (inicio + i) % lista.length;
    cola.push({ tipo: 'general', ref: `general:${periodo}:${n}`, contenido: lista[n] });
  }
  return cola;
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

  // UNA sola recomendación, debajo de los gráficos. La primera que haya, en
  // este orden: la que armó la IA con los datos de la persona (la de hoy, si
  // no la de la semana o el mes), después el tope sugerido con lo que suele
  // gastar y, si no hay nada de eso, un consejo general. Mientras llegan los
  // datos no se muestra nada: que aparezca una general y un segundo después la
  // cambie la personalizada es peor que esperar.
  if (!datos && !fallo) return null;
  const candidatas = PERIODOS_RECOMENDACION.flatMap((p) => {
    const it = colaDe(p, datos, estado).find((x) => !hechas.has(`${p}|${x.ref}`));
    return it ? [{ periodo: p, item: it }] : [];
  });
  const elegida = candidatas.find((c) => c.item.tipo === 'ia')
    ?? candidatas.find((c) => c.item.tipo === 'calculada')
    ?? candidatas.find((c) => c.periodo === 'dia')
    ?? candidatas[0]
    ?? null;
  if (!elegida) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Recomendación de FINA">
      {/* Fini se asoma desde atrás del cartel: va detrás (z-0) y el cartel lo
          tapa hasta la mitad, así parece que sale de adentro. Es un momento de
          acompañamiento (§6): Fini acompaña el consejo, no reacciona a un
          gasto. Sube una vez al aparecer y se queda quieta. */}
      <div className="relative pt-9">
        <div className="absolute right-5 top-0 z-0 v2-fini-asoma" aria-hidden>
          <Fini state="idle" size={56} />
        </div>
        <div className="relative z-10 rounded-2xl px-4 py-3.5" style={{ background: COLORS.starSoft }}>
          <Mensaje key={`${elegida.periodo}-${elegida.item.ref}`} item={elegida.item} onUtil={marcarUtilidad} />
        </div>
      </div>
      <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
        {elegida.item.tipo === 'ia' ? 'Hecha con IA a partir de tus datos. No es asesoramiento financiero.'
          : elegida.item.tipo === 'calculada' ? 'Calculada con tus gastos de los últimos 30 días. No es asesoramiento financiero.'
          : 'Recomendación general. No es asesoramiento financiero.'}
      </p>
    </section>
  );
}

// Un mensaje, sin casilla: se lee, no se cumple. Va en un cartel amarillo
// suave (el color de Fini y de los momentos de marca), debajo del paso del día.
function Mensaje({ item, onUtil }: {
  item: Item;
  onUtil: (id: string, util: boolean | null) => void;
}) {
  const r = item.contenido;
  return (
    <article className="flex flex-col gap-2">
      <h3 className="text-[15px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>
        {r.titulo}
      </h3>
      <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.texto}</p>

      {(item.tipo === 'ia' || item.tipo === 'calculada') && (
        <>
          {/* El dato en el que se apoya, con contra qué se compara. */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[15px] font-semibold font-mono tabular-nums" style={{ color: COLORS.ink }}>{item.contenido.dato.valor}</p>
            <p className="text-[14px] leading-snug" style={{ color: COLORS.inkSoft }}>{item.contenido.dato.referencia}</p>
            {item.contenido.confianza === 'estimado' && <EstadoConfianza estado="estimado" />}
          </div>

          {/* Lo que marca la persona es lo que usa el modelo la próxima vez
              para no insistir con lo que no le sirve. Tocar de nuevo saca la marca. */}
          {item.tipo === 'ia' && (
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
          )}
        </>
      )}
    </article>
  );
}

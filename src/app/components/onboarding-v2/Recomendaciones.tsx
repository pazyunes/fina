import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Fini } from './Fini';
import { COLORS, EstadoConfianza, FONTS, TituloSeccion } from './shared';
import { LinkWhatsApp } from './LinkWhatsApp';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { usePasoDelDia } from '../../api/v2/PasoDelDiaProvider';
import { diaArgentina, pasosPosiblesManana, type AccionPaso } from '../../api/v2/pasos';
import {
  PERIODOS_RECOMENDACION, leerRecomendaciones, marcarUtil, recomendacionesRecordadas,
  type DestinoRecomendacion, type PeriodoRecomendacion, type Recomendaciones as RecomendacionesT, type TarjetaRecomendacion,
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
// si algo falla), en vez de un "necesito más datos" se muestra un consejo
// general que sirve a cualquiera que arranca. Rotan por día, semana y mes para
// que no sea siempre el mismo. No usan IA ni cuestan nada.
//
// Salen de lo mismo que el prompt de la IA: registrar arma el hábito, lo
// automático le gana a la fuerza de voluntad, no hace falta recortar gustos
// chicos, y las palancas que mueven algo son las que se repiten. Sin montos ni
// instrumentos de inversión.
type General = { titulo: string; texto: string; accion?: { etiqueta: string; destino: DestinoRecomendacion; abrir?: AccionPaso } };

const GENERALES: Record<PeriodoRecomendacion, General[]> = {
  dia: [
    { titulo: 'Anotá todo lo de hoy, hasta lo chico', texto: 'Registrar cada gasto, aunque sea un café, es lo que arma el hábito. Con unos días anotados ya se ve en qué se te va la plata.', accion: { etiqueta: 'Registrar un gasto', destino: 'gastos', abrir: 'gasto' } },
    { titulo: 'Contale tus gastos a FINA por WhatsApp', texto: 'Escribile como a una amiga: "gasté 5.000 en el súper". Es la forma más rápida de no olvidarte de ninguno.', accion: { etiqueta: 'Abrir WhatsApp', destino: 'whatsapp' } },
    { titulo: 'Antes de pagar en cuotas, sumá las que ya tenés', texto: 'Las cuotas sin interés sirven, pero comprometen la plata de los próximos meses. Mirá cuánto pagás por mes entre todas.' },
    { titulo: 'Revisá tus suscripciones', texto: 'Plataformas, apps, gimnasio: se cobran solas todos los meses sin que las vuelvas a decidir. Anotalas para ver cuánto suman.', accion: { etiqueta: 'Registrar un gasto', destino: 'gastos', abrir: 'gasto' } },
  ],
  semana: [
    { titulo: 'Elegí una sección para mirar esta semana', texto: 'No hace falta ordenar todo junto. Elegí una, como delivery o salidas, y fijate cuánto se va ahí.', accion: { etiqueta: 'Ver mis gastos', destino: 'gastos' } },
    { titulo: 'Separá apenas cobrás', texto: 'Lo que se aparta al principio se ahorra; lo que se deja para fin de mes, casi nunca. Aunque sea poco, separalo el día que entra la plata.', accion: { etiqueta: 'Ir a mis objetivos', destino: 'objetivos' } },
    { titulo: 'No hace falta dejar tus gustos', texto: 'Recortar el café o una salida mueve poco y cansa. Lo que más cambia es lo que se repite: suscripciones, el delivery de todas las semanas, las cuotas.' },
  ],
  mes: [
    { titulo: 'Ponele un tope a la sección que más se te va', texto: 'Un tope no es una prohibición: es un aviso de cuánto querés gastar ahí. Empezá por una sola sección.', accion: { etiqueta: 'Poner un tope', destino: 'gastos', abrir: 'tope' } },
    { titulo: 'Armá un objetivo, aunque no sepas el monto', texto: 'Ponerle nombre a para qué ahorrás ayuda a sostenerlo. El monto lo podés completar después.', accion: { etiqueta: 'Ir a mis objetivos', destino: 'objetivos' } },
    { titulo: 'Tené algo apartado para imprevistos', texto: 'Un fondo para lo que no esperabas evita tener que endeudarte con la tarjeta o un préstamo cuando pasa.', accion: { etiqueta: 'Ir a mis objetivos', destino: 'objetivos' } },
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

const RUTA: Record<Exclude<DestinoRecomendacion, 'whatsapp'>, string> = {
  gastos: '/onboarding-v2/gastos',
  objetivos: '/onboarding-v2/objetivos',
  inversiones: '/onboarding-v2/inversiones',
  perfil: '/onboarding-v2/perfil',
  grupos: '/onboarding-v2/grupos',
};

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

  const navigate = useNavigate();
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
        <div className="rounded-2xl px-4 py-3.5 flex flex-col gap-2.5 mt-1" style={{ background: COLORS.brandSoft }}>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>
            <strong>Recordá registrar tus gastos.</strong> Con unos días anotados, estas recomendaciones se arman con tus números y cómo te manejás.
          </p>
          <button
            type="button"
            onClick={() => navigate('/onboarding-v2/gastos', { state: { abrir: 'gasto' } })}
            className="v2-focus self-start min-h-[44px] px-4 rounded-full text-[15px] font-bold"
            style={{ background: COLORS.brand, color: COLORS.surface }}
          >
            Registrar un gasto
          </button>
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
  const navigate = useNavigate();

  const etiqueta = (
    <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
      {ETIQUETA[periodo]}
    </p>
  );

  if (tarjeta.estado !== 'lista') return <TarjetaGeneral periodo={periodo} />;

  const { contenido: r, id, util } = tarjeta;
  const accion = r.accion;
  const destino = accion?.destino ?? null;

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
        {accion && destino && (
          destino === 'whatsapp' ? (
            <LinkWhatsApp
              className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[15px] font-bold"
              style={{ background: COLORS.lima, color: COLORS.ink }}
            >
              {accion.etiqueta}
            </LinkWhatsApp>
          ) : (
            <button
              type="button"
              onClick={() => navigate(RUTA[destino])}
              className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[15px] font-bold"
              style={{ color: COLORS.brand, border: `1.5px solid ${COLORS.brandSoft}` }}
            >
              {accion.etiqueta}
            </button>
          )
        )}

        {/* Lo que marca la persona es lo que usa el modelo la próxima vez para
            no insistir con lo que no le sirve. Tocar de nuevo saca la marca. */}
        <div className="flex items-center gap-1 ml-auto" role="group" aria-label="¿Te sirvió esta recomendación?">
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
  const navigate = useNavigate();
  const r = generalDe(periodo);
  const accion = r.accion;
  const destino = accion?.destino;
  return (
    <article className="py-4 border-b last:border-b-0 flex flex-col gap-2" style={{ borderColor: COLORS.line }}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: COLORS.inkSoft, fontFamily: FONTS.mono }}>
        {ETIQUETA[periodo]}
      </p>
      <h3 className="text-[18px] font-bold leading-tight" style={{ color: COLORS.ink, fontFamily: FONTS.display }}>{r.titulo}</h3>
      <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{r.texto}</p>
      {accion && destino && (
        <div className="pt-1">
          {destino === 'whatsapp' ? (
            <LinkWhatsApp
              className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[15px] font-bold"
              style={{ background: COLORS.lima, color: COLORS.ink }}
            >
              {accion.etiqueta}
            </LinkWhatsApp>
          ) : (
            <button
              type="button"
              onClick={() => navigate(RUTA[destino], accion.abrir ? { state: { abrir: accion.abrir } } : undefined)}
              className="v2-focus inline-flex items-center min-h-[44px] px-4 rounded-full text-[15px] font-bold"
              style={{ color: COLORS.brand, border: `1.5px solid ${COLORS.brandSoft}` }}
            >
              {accion.etiqueta}
            </button>
          )}
        </div>
      )}
    </article>
  );
}


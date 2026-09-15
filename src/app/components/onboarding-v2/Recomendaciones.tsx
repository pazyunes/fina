import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Fini } from './Fini';
import { COLORS, EstadoConfianza, FONTS, TituloSeccion } from './shared';
import { LinkWhatsApp } from './LinkWhatsApp';
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

  useEffect(() => {
    let vivo = true;
    void leerRecomendaciones().then((r) => {
      if (!vivo) return;
      if (r.error !== null) { if (!recomendacionesRecordadas()) setFallo(true); return; }
      setFallo(false);
      setDatos(r.data);
    });
    return () => { vivo = false; };
  }, []);

  // Si todavía no hay forma de generarlas (falta la clave en el servidor), la
  // sección no se muestra: un cartel de "no disponible" en Home no le sirve a
  // nadie.
  if (datos && PERIODOS_RECOMENDACION.every((p) => datos[p].estado === 'no_configurado')) return null;

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

      {!datos ? (
        <div className="flex items-center gap-3 py-2">
          <div className="shrink-0 -ml-2"><Fini state="pensando" size={64} /></div>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }} role="status">
            {fallo
              ? 'No pudimos traer tus recomendaciones. Probá de nuevo más tarde.'
              : 'Estoy mirando cómo te venís manejando para recomendarte algo. La primera vez tarda un poco.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {PERIODOS_RECOMENDACION.map((p) => (
              <Tarjeta key={p} periodo={p} tarjeta={datos[p]} onMarcar={marcar} />
            ))}
          </div>
          <p className="text-[13px] leading-snug" style={{ color: COLORS.inkFaint }}>
            Sugerencias hechas con IA a partir de tus datos. No son asesoramiento financiero.
          </p>
        </>
      )}
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

  if (tarjeta.estado !== 'lista') {
    const texto =
      tarjeta.estado === 'faltan_datos' ? tarjeta.mensaje
      : tarjeta.estado === 'error' ? tarjeta.mensaje
      : tarjeta.estado === 'no_configurado' ? 'Todavía no está disponible.'
      : 'Por ahora no hay nada nuevo para decirte. Seguí registrando y vuelvo con algo.';
    return (
      <article className="py-3.5 border-b last:border-b-0 flex flex-col gap-1" style={{ borderColor: COLORS.line }}>
        {etiqueta}
        <p className="text-[15px] leading-snug" style={{ color: COLORS.inkSoft }}>{texto}</p>
      </article>
    );
  }

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

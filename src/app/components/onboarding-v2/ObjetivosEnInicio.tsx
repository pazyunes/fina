import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { enMoneda } from '../../api/v2/conversion';
import type { Moneda, Objetivo } from '../../api/v2/tipos';
import {
  aporteDeLaSemana, diaArgentina, mensajePlazo, ritmoSemanal, situacionPlazo,
  type AporteEnMoneda, type MensajePlazo, type SituacionPlazo,
} from '../../utils/goalStrategies';
import { COLORS, EstadoConfianza, TituloSeccion, fmtMoney } from './shared';

// ─────────────────────────────────────────────────────────────────────────
// Objetivos en Home (DEBT I7): el objetivo que más importa hoy, cuánto avanzó
// esta semana y el próximo paso. Reemplaza a la tarjeta de anillos que había en
// Mis visualizaciones, que mostraba el avance pero nunca qué hacer con él.
//
// Cuál se muestra: el de plazo más cercano (si alguno tiene una fecha que se
// entiende); si no, el más avanzado; si ninguno tiene monto, el primero.
//
// Un objetivo atrasado se dice como dato con salida, en naranja de relleno
// (atención accionable) y nunca en rojo: no es un error (frontend.md §2.3).
// ─────────────────────────────────────────────────────────────────────────

/** Formatea en la moneda del objetivo: $ para pesos, el código para el resto. */
export function fmtEnMoneda(n: number, moneda: Moneda): string {
  if (moneda === 'ARS') return fmtMoney(n);
  return `${moneda} ${Math.round(n).toLocaleString('es-AR')}`;
}

export type DatosObjetivo = {
  aportes: AporteEnMoneda[];
  /** Lo juntado en la moneda del objetivo. Declarado (o estimado si hubo que convertir). */
  juntado: number;
  /** 0 = sin monto. */
  total: number;
  restante: number;
  /** Promedio por semana de las últimas 4 semanas. */
  ritmo: number;
  /** Lo sumado en los últimos 7 días (el delta de §5.3). */
  semana: number;
  /** Unidades de la moneda del objetivo por peso; null = no se puede convertir. */
  factor: number | null;
  situacion: SituacionPlazo;
};

/** Todo lo que hace falta saber de un objetivo para hablar de su avance y su plazo. */
export function datosDelObjetivo(o: Objetivo, dolar: number | null, ahora: number = Date.now()): DatosObjetivo {
  const aportes: AporteEnMoneda[] = [];
  for (const c of o.contribuciones) {
    const v = enMoneda(c, o.moneda, dolar);
    if (v !== null) aportes.push({ monto: v, ts: c.ts });
  }
  const juntado = aportes.reduce((s, a) => s + a.monto, 0);
  const total = o.montoTotal ?? 0;
  const restante = Math.max(total - juntado, 0);
  const ritmo = ritmoSemanal(aportes, ahora);
  const factor = o.moneda === 'ARS' ? 1 : o.moneda === 'USD' && dolar ? 1 / dolar : null;
  return {
    aportes, juntado, total, restante, ritmo,
    semana: aporteDeLaSemana(aportes, ahora),
    factor,
    situacion: situacionPlazo({ horizonte: o.horizonte, restante, montoTotal: total || null, ritmo, hoy: diaArgentina(ahora) }),
  };
}

/** Borde de color según el tono del mensaje: relleno, nunca texto (§3.3). */
export function colorDeTono(tono: MensajePlazo['tono']): string {
  return tono === 'accion' ? COLORS.naranja : tono === 'logro' ? COLORS.lima : COLORS.line;
}

function elegir(objetivos: Objetivo[], dolar: number | null): { o: Objetivo; d: DatosObjetivo } | null {
  const conDatos = objetivos
    .filter((o) => o.estado === 'active')
    .map((o) => ({ o, d: datosDelObjetivo(o, dolar) }));
  if (conDatos.length === 0) return null;
  const enCurso = conDatos.filter((x) => x.d.total > 0 && x.d.restante > 0);
  const conPlazo = enCurso
    .filter((x) => 'dias' in x.d.situacion)
    .sort((a, b) => ('dias' in a.d.situacion ? a.d.situacion.dias : 0) - ('dias' in b.d.situacion ? b.d.situacion.dias : 0));
  if (conPlazo.length > 0) return conPlazo[0];
  if (enCurso.length > 0) return [...enCurso].sort((a, b) => b.d.juntado / b.d.total - a.d.juntado / a.d.total)[0];
  return conDatos[0];
}

export function ObjetivosEnInicio() {
  const { estado } = useAlmacen();
  const navigate = useNavigate();
  const elegido = elegir(estado.objetivos, estado.dolar);

  if (!elegido) {
    return (
      <section className="flex flex-col gap-2" aria-label="Tus objetivos">
        <TituloSeccion>Tus objetivos</TituloSeccion>
        <p className="text-[15px]" style={{ color: COLORS.inkSoft }}>Ponele nombre a algo que quieras lograr.</p>
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/objetivos', { state: { crearObjetivo: true, from: '/onboarding-v2/home' } })}
          className="v2-focus self-start min-h-[44px] rounded-full px-5 text-[15px] font-bold transition-all duration-100 active:scale-95"
          style={{ background: COLORS.brand, color: COLORS.surface }}
        >
          Crear un objetivo
        </button>
      </section>
    );
  }

  const { o, d } = elegido;
  const fmt = (n: number) => fmtEnMoneda(n, o.moneda);
  const conMonto = d.total > 0;
  const pct = conMonto ? Math.min(100, Math.round((d.juntado / d.total) * 100)) : 0;
  const mensaje = mensajePlazo(d.situacion, fmt);
  const abrir = () => navigate('/onboarding-v2/objetivos', {
    state: { abrir: 'aporte_objetivo', objetivoId: o.id, from: '/onboarding-v2/home' },
  });

  return (
    <section className="flex flex-col gap-3" aria-label="Tu objetivo">
      <div className="flex items-baseline justify-between gap-3">
        <TituloSeccion>{o.nombre}</TituloSeccion>
        <button
          type="button"
          onClick={() => navigate('/onboarding-v2/objetivos')}
          className="v2-focus shrink-0 min-h-[44px] text-[14px] font-semibold underline"
          style={{ color: COLORS.brand }}
        >
          Ver objetivos
        </button>
      </div>

      {conMonto ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div
            className="h-2.5 rounded-full overflow-hidden"
            style={{ background: COLORS.limaSoft }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${pct}% juntado`}
          >
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS.limaViz }} />
          </div>
          <p className="text-[15px]" style={{ color: COLORS.ink }}>
            Llevás <span className="font-semibold font-mono tabular-nums">{fmt(d.juntado)}</span> de{' '}
            <span className="font-mono tabular-nums">{fmt(d.total)}</span>
          </p>
          {/* El delta de la semana en lima: el avance chico igual se lee como avance (§5.3). */}
          {d.semana > 0 && (
            <p className="text-[15px] font-semibold font-mono tabular-nums" style={{ color: COLORS.limaText }}>
              +{fmt(d.semana)} esta semana
            </p>
          )}
          <EstadoConfianza estado="declarado" />
        </div>
      ) : (
        <EstadoConfianza estado="por-descubrir" />
      )}

      {mensaje && (
        <div className="flex flex-col gap-1 pl-3.5 border-l-[3px]" style={{ borderColor: colorDeTono(mensaje.tono) }}>
          <p className="text-[15px] leading-snug" style={{ color: COLORS.ink }}>{mensaje.texto}</p>
          {mensaje.salida && <p className="text-[15px] leading-snug font-mono tabular-nums" style={{ color: COLORS.ink }}>{mensaje.salida}</p>}
          <EstadoConfianza estado="estimado" />
        </div>
      )}

      <button
        type="button"
        onClick={abrir}
        className="v2-focus self-start min-h-[44px] rounded-full px-5 text-[15px] font-bold transition-all duration-100 active:scale-95"
        style={{ background: COLORS.brand, color: COLORS.surface }}
      >
        {conMonto ? 'Sumar un registro' : 'Ponerle un monto'}
      </button>
    </section>
  );
}

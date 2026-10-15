import { useNavigate } from 'react-router';
import { useAlmacen } from '../../api/v2/AlmacenProvider';
import { enMoneda } from '../../api/v2/conversion';
import type { Moneda, Objetivo } from '../../api/v2/tipos';
import {
  aporteDeLaSemana, diaArgentina, mensajePlazo, ritmoSemanal, situacionPlazo,
  type AporteEnMoneda, type MensajePlazo, type SituacionPlazo,
} from '../../utils/goalStrategies';
import { COLORS, fmtMoney } from './shared';
import { IconChevron } from './FinaIcons';

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

// En Inicio es UNA fila que lleva a Objetivos, no el detalle (frontend.md,
// Inicio es un tablero de entradas): el nombre, una barrita de avance y una
// línea corta. El detalle (plazo, salida en rango, formas de llegar antes)
// vive en la pantalla de Objetivos, que se abre con este objetivo y el
// formulario para sumar.
export function ObjetivosEnInicio() {
  const { estado } = useAlmacen();
  const navigate = useNavigate();
  const elegido = elegir(estado.objetivos, estado.dolar);

  if (!elegido) {
    return (
      <Entrada
        titulo="Creá tu primer objetivo"
        linea="Algo para lo que quieras juntar"
        onClick={() => navigate('/onboarding-v2/objetivos', { state: { crearObjetivo: true, from: '/onboarding-v2/home' } })}
      />
    );
  }

  const { o, d } = elegido;
  const fmt = (n: number) => fmtEnMoneda(n, o.moneda);
  const conMonto = d.total > 0;
  const pct = conMonto ? Math.min(100, Math.round((d.juntado / d.total) * 100)) : null;
  const mensaje = mensajePlazo(d.situacion, fmt);
  // Una sola línea: si está atrasado, eso (es lo accionable); si avanzó esta
  // semana, el delta (§5.3); si no, cuánto lleva.
  const linea = mensaje?.tono === 'accion'
    ? mensaje.texto
    : d.semana > 0 ? `+${fmt(d.semana)} esta semana`
    : conMonto ? `Llevás ${fmt(d.juntado)} de ${fmt(d.total)}`
    : 'Ponele un monto para ver cuánto falta';

  return (
    <Entrada
      titulo={conMonto ? `Sumale a ${o.nombre}` : o.nombre}
      linea={linea}
      pct={pct}
      atencion={mensaje?.tono === 'accion'}
      onClick={() => navigate('/onboarding-v2/objetivos', {
        state: { abrir: 'aporte_objetivo', objetivoId: o.id, from: '/onboarding-v2/home' },
      })}
    />
  );
}

/** Fila-botón de Inicio: título, una línea y, si hay, una barrita de avance. */
function Entrada({ titulo, linea, pct = null, atencion = false, onClick }: {
  titulo: string; linea: string; pct?: number | null; atencion?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v2-focus w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 transition-transform duration-100 active:scale-[0.99]"
      style={{ background: COLORS.surface, border: `1.5px solid ${atencion ? COLORS.naranja : COLORS.line}` }}
    >
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[14px] font-bold truncate" style={{ color: COLORS.ink }}>{titulo}</span>
        {pct !== null && (
          <span className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.limaSoft }} aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: COLORS.limaViz }} />
          </span>
        )}
        <span className="text-[13px] truncate font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>{linea}</span>
      </span>
      <IconChevron size={16} style={{ color: COLORS.inkSoft }} />
    </button>
  );
}

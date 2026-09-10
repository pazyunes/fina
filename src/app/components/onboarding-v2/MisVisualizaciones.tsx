import { useState } from 'react';
import type { ComponentType } from 'react';
import { IconBalanza, IconCalendario, IconGastos, IconObjetivos } from './FinaIcons';
import { COLORS, FONTS, TituloSeccion, fmtMoney, fmtMontoCompacto, vistaGastos, vistaInversiones, vistaObjetivos } from './shared';

// PRUEBA — "Mis visualizaciones" en Home. Se eligen entre varios gráficos
// armados con los datos que ya hay guardados: nada inventado, y si no alcanzan
// los datos el gráfico lo dice en vez de dibujar una línea plana.
//
// Cada gráfico sigue la misma receta que el resto de la app: eje con valores,
// grilla recesiva, y ningún dato sin su unidad.

type GastoLite = { monto: number; ts?: number; categoriaId: string; tipo: string; descripcion?: string };

type VizId = 'porSeccion' | 'porDia' | 'porTipo' | 'objetivos';
// Iconos de línea, no emojis (§2.1: iconografía monolineal). Las etiquetas se
// acortaron para que las cuatro entren en una sola fila; el título del gráfico
// de abajo ya dice qué estás mirando, así que el chip no necesita la frase
// entera.
const VIZ: { id: VizId; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { id: 'porSeccion', label: 'Por sección', Icon: IconGastos },
  { id: 'porDia', label: 'Por día', Icon: IconCalendario },
  { id: 'porTipo', label: 'Por tipo', Icon: IconBalanza },
  { id: 'objetivos', label: 'Objetivos', Icon: IconObjetivos },
];

// Lo que el chip no dice, lo dice el subtítulo del gráfico.
const VIZ_SUBTITULO: Record<VizId, string> = {
  porSeccion: 'En qué se te va la plata',
  porDia: 'Cuánto gastaste cada día de la semana',
  porTipo: 'Cuánto fue necesario y cuánto impulso',
  objetivos: 'Cuánto te falta para cada uno',
};

const PALETA = [COLORS.brand, COLORS.naranja, COLORS.star, COLORS.lima, COLORS.lila, COLORS.brandDark];

function SinDatos({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-snug pl-3.5 border-l-2 py-1" style={{ color: COLORS.inkSoft, borderColor: COLORS.brandSoft }}>
      {children}
    </p>
  );
}

// Barras horizontales: la forma correcta para comparar magnitudes con
// etiquetas de texto largo (una torta obliga a comparar ángulos).
function Barras({ filas, total }: { filas: { label: string; valor: number; color: string }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[14.5px] truncate" style={{ color: COLORS.ink }}>{f.label}</span>
            <span className="text-[14px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{fmtMoney(f.valor)}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
            <div className="h-full rounded-full" style={{ width: `${total > 0 ? (f.valor / total) * 100 : 0}%`, background: f.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Barras verticales por día, con eje. Para "cuánto gasté cada día" el eje X es
// tiempo, así que la forma es columna y no barra horizontal.
function Columnas({ dias }: { dias: { etiqueta: string; valor: number }[] }) {
  const max = Math.max(...dias.map((d) => d.valor), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1.5" style={{ height: 130 }}>
        {dias.map((d) => (
          <div key={d.etiqueta} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            {d.valor > 0 && (
              <span className="text-[10px] font-mono tabular-nums" style={{ color: COLORS.inkSoft }}>{fmtMontoCompacto(d.valor)}</span>
            )}
            <div
              className="w-full rounded-t-md"
              style={{ height: `${(d.valor / max) * 100}%`, minHeight: d.valor > 0 ? 4 : 2, background: d.valor > 0 ? COLORS.brand : COLORS.line }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {dias.map((d) => (
          <span key={d.etiqueta} className="flex-1 text-center text-[11px]" style={{ color: COLORS.inkFaint, fontFamily: FONTS.mono }}>{d.etiqueta}</span>
        ))}
      </div>
    </div>
  );
}

export function MisVisualizaciones() {
  const [viz, setViz] = useState<VizId>('porSeccion');
  const g = vistaGastos();
  const objetivos = vistaObjetivos();
  const inv = vistaInversiones();
  const gastos = g.gastos;

  function contenido() {
    if (viz === 'porSeccion') {
      if (gastos.length === 0) return <SinDatos>Cuando registres tu primer gasto, acá vas a ver en qué se te va.</SinDatos>;
      const porCat = g.categorias
        .map((c, i) => ({
          label: c.nombre,
          // En pesos, no en la moneda de cada gasto: sumar US$20 como "20"
          // haría que la barra de esa sección se vea 1.500 veces más chica.
          valor: gastos.filter((x) => x.categoriaId === c.id).reduce((a, x) => a + x.montoArs, 0),
          color: PALETA[i % PALETA.length],
        }))
        .filter((f) => f.valor > 0)
        .sort((a, b) => b.valor - a.valor);
      if (porCat.length === 0) return <SinDatos>Todavía no hay gastos con sección.</SinDatos>;
      return <Barras filas={porCat} total={porCat.reduce((a, f) => a + f.valor, 0)} />;
    }

    if (viz === 'porDia') {
      if (gastos.length === 0) return <SinDatos>Con un par de gastos registrados vas a ver tu semana día por día.</SinDatos>;
      // Últimos 7 días, terminando hoy.
      const dias = Array.from({ length: 7 }, (_, k) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - k));
        const clave = d.toDateString();
        return {
          etiqueta: ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'][d.getDay()],
          valor: gastos.filter((x) => x.ts && new Date(x.ts).toDateString() === clave).reduce((a, x) => a + x.montoArs, 0),
        };
      });
      return <Columnas dias={dias} />;
    }

    if (viz === 'porTipo') {
      if (gastos.length === 0) return <SinDatos>Cuando registres gastos vas a poder ver cuánto fue necesario y cuánto impulso.</SinDatos>;
      const etiquetas: Record<string, string> = { necesario: 'Necesario', urgente: 'Urgente', impulsivo: 'Impulsivo', otro: 'Otro' };
      const filas = Object.keys(etiquetas)
        .map((t, i) => ({
          label: etiquetas[t],
          valor: gastos.filter((x) => x.tipo === t).reduce((a, x) => a + x.montoArs, 0),
          color: PALETA[i % PALETA.length],
        }))
        .filter((f) => f.valor > 0)
        .sort((a, b) => b.valor - a.valor);
      if (filas.length === 0) return <SinDatos>Todavía no hay gastos clasificados.</SinDatos>;
      return <Barras filas={filas} total={filas.reduce((a, f) => a + f.valor, 0)} />;
    }

    // objetivos
    const conMonto = objetivos.filter((o) => o.montoTotal > 0);
    if (conMonto.length === 0) {
      return <SinDatos>Sumá un objetivo con su monto y acá vas a ver cuánto te falta para cada uno.</SinDatos>;
    }
    return (
      <div className="flex flex-col gap-3">
        {conMonto.map((o, i) => {
          const juntado = o.contribuciones.reduce((a, c) => a + c.monto, 0);
          const pct = Math.min(100, Math.round((juntado / o.montoTotal) * 100));
          return (
            <div key={o.nombre} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14.5px] truncate" style={{ color: COLORS.ink }}>{o.nombre}</span>
                <span className="text-[14px] font-semibold shrink-0 font-mono tabular-nums" style={{ color: COLORS.ink }}>{pct}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: COLORS.line }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PALETA[i % PALETA.length] }} />
              </div>
              <span className="text-[13px]" style={{ color: COLORS.inkSoft }}>
                Llevás <span className="font-mono tabular-nums">{fmtMoney(juntado)}</span> de <span className="font-mono tabular-nums">{fmtMoney(o.montoTotal)}</span>
              </span>
            </div>
          );
        })}
        {inv && inv.aportes.length > 0 && (
          <span className="text-[13px]" style={{ color: COLORS.inkFaint }}>
            Tus inversiones se ven aparte, en su propia sección.
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <TituloSeccion>Mis visualizaciones</TituloSeccion>
      {/* Una sola fila. Si en una pantalla angosta no entran las cuatro, se
          desplaza en horizontal en vez de saltar a un segundo renglón: la fila
          de filtros arriba del gráfico tiene que leerse como una sola cosa.
          El scrollbar se oculta porque el corte del último chip ya avisa que
          hay más. */}
      <div
        className="flex gap-2 overflow-x-auto flex-nowrap -mx-6 px-6"
        style={{ scrollbarWidth: 'none' }}
        role="tablist"
      >
        {VIZ.map((v) => {
          const on = viz === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setViz(v.id)}
              className="v2-focus inline-flex items-center gap-1.5 min-h-[44px] shrink-0 rounded-full px-3.5 text-[14.5px] font-semibold whitespace-nowrap transition-all duration-100 active:scale-[0.97]"
              style={on
                ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            >
              <span aria-hidden style={{ color: on ? COLORS.surface : COLORS.brand }}><v.Icon size={18} /></span>
              {v.label}
            </button>
          );
        })}
      </div>
      <p className="text-[14px] -mt-1" style={{ color: COLORS.inkSoft }}>{VIZ_SUBTITULO[viz]}</p>
      <div className="pt-1">{contenido()}</div>
    </section>
  );
}

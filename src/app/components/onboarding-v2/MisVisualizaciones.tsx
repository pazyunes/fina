import { useState } from 'react';
import { COLORS, FONTS, TituloSeccion, fmtMoney, fmtMontoCompacto, loadV2GastosState, loadV2InversionesState, loadV2ObjetivosState } from './shared';

// PRUEBA — "Mis visualizaciones" en Home. Se eligen entre varios gráficos
// armados con los datos que ya hay guardados: nada inventado, y si no alcanzan
// los datos el gráfico lo dice en vez de dibujar una línea plana.
//
// Cada gráfico sigue la misma receta que el resto de la app: eje con valores,
// grilla recesiva, y ningún dato sin su unidad.

type GastoLite = { monto: number; ts?: number; categoriaId: string; tipo: string; descripcion?: string };
type EstadoGastosLite = { gastos: GastoLite[]; categorias: { id: string; nombre: string }[] };
type ObjLite = { nombre: string; montoTotal: number; contribuciones: { monto: number }[] };
type InvLite = { aportes: { monto: number; montoArs?: number; ts: number }[] };

type VizId = 'porSeccion' | 'porDia' | 'porTipo' | 'objetivos';
const VIZ: { id: VizId; label: string; emoji: string }[] = [
  { id: 'porSeccion', label: 'En qué se me va', emoji: '🧾' },
  { id: 'porDia', label: 'Día por día', emoji: '📅' },
  { id: 'porTipo', label: 'Necesario vs impulso', emoji: '⚖️' },
  { id: 'objetivos', label: 'Mis objetivos', emoji: '🎯' },
];

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
  const g = loadV2GastosState<EstadoGastosLite>();
  const objetivos = loadV2ObjetivosState<ObjLite[]>() ?? [];
  const inv = loadV2InversionesState<InvLite>();
  const gastos = g?.gastos ?? [];

  function contenido() {
    if (viz === 'porSeccion') {
      if (gastos.length === 0) return <SinDatos>Cuando registres tu primer gasto, acá vas a ver en qué se te va.</SinDatos>;
      const porCat = (g?.categorias ?? [])
        .map((c, i) => ({
          label: c.nombre,
          valor: gastos.filter((x) => x.categoriaId === c.id).reduce((a, x) => a + x.monto, 0),
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
          valor: gastos.filter((x) => x.ts && new Date(x.ts).toDateString() === clave).reduce((a, x) => a + x.monto, 0),
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
          valor: gastos.filter((x) => x.tipo === t).reduce((a, x) => a + x.monto, 0),
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
      <div className="flex flex-wrap gap-2">
        {VIZ.map((v) => {
          const on = viz === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setViz(v.id)}
              aria-pressed={on}
              className="v2-focus inline-flex items-center gap-1.5 min-h-[44px] rounded-full px-3.5 text-[14.5px] font-semibold transition-all duration-100 active:scale-[0.97]"
              style={on
                ? { background: COLORS.brand, color: COLORS.surface, border: `1.5px solid ${COLORS.brand}` }
                : { background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.lineStrong}` }}
            >
              <span aria-hidden>{v.emoji}</span>
              {v.label}
            </button>
          );
        })}
      </div>
      <div className="pt-1">{contenido()}</div>
    </section>
  );
}
